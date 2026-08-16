import "server-only";

import { randomBytes } from "node:crypto";
import {
  BillingCycle,
  PaymentProvider,
  PaymentStatus,
  SubscriptionPlan,
} from "@/generated/prisma/enums";
import type { Payment } from "@/generated/prisma/client";
import {
  activerApresPaiement,
  appliquerLimiteSieges,
  getAbonnement,
} from "@/lib/abonnement";
import { prixPour } from "@/lib/plans";
import { prisma, prismaHorsPortee } from "@/lib/prisma";

/**
 * Facturation des abonnements — PROJET.md §9.
 *
 * À ne pas confondre avec `lib/paiement.ts`, qui décrit les moyens de paiement
 * d'une *dépense*. Ici il s'agit de ce que l'entreprise paie à Xaalis.
 *
 * Le paiement se fait sur un lien Wave, hors de Xaalis. Il en découle trois
 * temps distincts, et il faut les garder distincts :
 *
 *   1. `lancerPaiement`   — Xaalis note ce qui est attendu (montant, référence)
 *   2. `declarerPaiement` — le client affirme avoir payé, pièce à l'appui
 *   3. `encaisserPaiement`— l'éditeur confirme après avoir vu l'argent
 *
 * Seule la troisième étape active quoi que ce soit. Les deux premières sont
 * déclaratives : elles n'engagent rien, parce qu'un client qui clique n'est pas
 * un client qui a payé.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1

/**
 * Référence lisible : elle sert de numéro de facture ET de `client_reference`
 * envoyé au prestataire. L'alphabet exclut les caractères qu'on confond en la
 * dictant au téléphone au support.
 */
function genererReference(maintenant = new Date()): string {
  const tirage = randomBytes(10);
  let suffixe = "";
  for (const octet of tirage) suffixe += ALPHABET[octet % ALPHABET.length];
  return `XAA-${maintenant.getFullYear()}-${suffixe}`;
}

/**
 * Note ce que l'entreprise doit payer, avant qu'elle n'aille sur Wave.
 *
 * Le montant est calculé ici depuis le catalogue, jamais reçu du client : un
 * formulaire trafiqué ne doit pas pouvoir acheter un plan Business au tarif
 * Starter. Rien n'est activé — cette ligne dit « voici ce qui est attendu »,
 * elle ne dit pas « c'est payé ».
 */
export async function lancerPaiement(params: {
  organizationId: string;
  plan: SubscriptionPlan;
  cycle: BillingCycle;
}): Promise<Payment> {
  const abonnement = await getAbonnement(params.organizationId);

  return prisma.payment.create({
    data: {
      organizationId: params.organizationId,
      subscriptionId: abonnement.id,
      reference: genererReference(),
      provider: PaymentProvider.WAVE,
      plan: params.plan,
      billingCycle: params.cycle,
      amount: prixPour(params.plan, params.cycle),
    },
  });
}

/** Ce que la déclaration d'un client peut donner. */
export type ResultatDeclaration =
  | { type: "enregistree" }
  | { type: "introuvable" }
  | { type: "deja-encaisse" };

/**
 * Le client affirme avoir payé et recopie l'identifiant de son reçu Wave.
 *
 * Cette pièce ne prouve rien à elle seule : elle est saisie au clavier par la
 * personne qui a intérêt à l'abonnement. Elle sert à retrouver le versement sur
 * le portefeuille marchand, pas à le remplacer — d'où `AWAITING_VERIFICATION`
 * et non `SUCCEEDED`. Confondre les deux reviendrait à offrir un plan Business
 * à qui sait taper une suite de caractères.
 */
export async function declarerPaiement(params: {
  organizationId: string;
  reference: string;
  transactionId: string;
}): Promise<ResultatDeclaration> {
  const paiement = await prisma.payment.findUnique({
    where: { reference: params.reference },
  });
  // L'appartenance se vérifie ici aussi : la référence circule dans une URL,
  // et rien n'empêche de coller celle d'une autre entreprise.
  if (!paiement || paiement.organizationId !== params.organizationId) {
    return { type: "introuvable" };
  }
  if (paiement.status === PaymentStatus.SUCCEEDED) {
    return { type: "deja-encaisse" };
  }

  await prisma.payment.update({
    where: { id: paiement.id },
    data: {
      status: PaymentStatus.AWAITING_VERIFICATION,
      providerTransactionId: params.transactionId,
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: paiement.organizationId,
      actorId: `client:${paiement.organizationId}`,
      entity: "Payment",
      entityId: paiement.id,
      action: "PAIEMENT_DECLARE",
      metadata: {
        reference: paiement.reference,
        transactionId: params.transactionId,
        montant: paiement.amount,
      },
    },
  });

  return { type: "enregistree" };
}

/**
 * Les déclarations qui attendent une vérification humaine.
 *
 * Hors portée, et c'est tout l'objet de la fonction : c'est la file d'attente
 * de l'ÉDITEUR, pas d'une entreprise. Elle alimente la console éditeur et
 * scripts/valider-paiement.ts, qui doivent voir les déclarations de tout le
 * monde pour les rapprocher des versements reçus sur Wave Business.
 */
export async function paiementsAVerifier() {
  return prismaHorsPortee.payment.findMany({
    where: { status: PaymentStatus.AWAITING_VERIFICATION },
    orderBy: { updatedAt: "asc" },
    include: { organization: { select: { name: true } } },
  });
}

/** Ce que le webhook peut conclure d'un événement. */
export type ResultatEncaissement =
  | { type: "encaisse" }
  | { type: "deja-traite" }
  | { type: "introuvable" }
  | { type: "montant-incoherent"; attendu: number; recu: number };

/**
 * Encaisse un paiement constaté et prolonge l'abonnement.
 *
 * C'est le SEUL point qui active un abonnement, et il le reste : deux chemins
 * y mènent désormais — `scripts/valider-paiement.ts` par
 * `/api/admin/paiements`, et la console éditeur par une action serveur — mais
 * tous deux appellent cette fonction. Deux implémentations divergeraient, et
 * c'est toujours celle qu'on ne teste pas qui casse.
 *
 * ⚠️ Depuis l'ouverture de la console (PROJET.md §7), cette fonction EST
 * atteignable depuis le web. Ce qui la protège n'est plus son inaccessibilité
 * mais l'authentification de son appelant : `ADMIN_SECRET` côté route,
 * `requireEditeur()` côté console.
 *
 * Reste idempotent : un paiement déjà encaissé ressort en « deja-traite ». Une
 * double validation par mégarde ne doit pas offrir un mois de plus.
 */
export async function encaisserPaiement(params: {
  reference: string;
  /**
   * Le montant réellement vu sur Wave. Facultatif : quand l'éditeur le saisit,
   * il est confronté au montant attendu et un écart bloque l'activation —
   * mieux vaut régulariser à la main qu'ouvrir un Business au tarif Starter.
   */
  montantRecu?: number;
  transactionId?: string;
  maintenant?: Date;
  /**
   * Qui encaisse. La ligne de commande ne sait pas le dire — d'où la valeur
   * par défaut ; la console, elle, connaît l'identifiant Clerk de l'éditeur
   * connecté. C'est la trace qui compense la barrière qu'on a levée.
   */
  actorId?: string;
}): Promise<ResultatEncaissement> {
  const paiement = await prisma.payment.findUnique({
    where: { reference: params.reference },
  });
  if (!paiement) return { type: "introuvable" };
  if (paiement.status === PaymentStatus.SUCCEEDED) return { type: "deja-traite" };

  if (params.montantRecu !== undefined && params.montantRecu !== paiement.amount) {
    await prisma.payment.update({
      where: { id: paiement.id },
      data: { status: PaymentStatus.FAILED },
    });
    return {
      type: "montant-incoherent",
      attendu: paiement.amount,
      recu: params.montantRecu,
    };
  }

  const maintenant = params.maintenant ?? new Date();
  const abonnement = await prisma.subscription.findUnique({
    where: { id: paiement.subscriptionId },
  });
  if (!abonnement) return { type: "introuvable" };

  await prisma.payment.update({
    where: { id: paiement.id },
    data: {
      status: PaymentStatus.SUCCEEDED,
      paidAt: maintenant,
      // Ne pas effacer l'identifiant déclaré par le client si l'éditeur valide
      // sans le ressaisir : c'est la pièce qui documente le rapprochement.
      providerTransactionId:
        params.transactionId ?? paiement.providerTransactionId,
    },
  });

  await activerApresPaiement({
    subscriptionId: abonnement.id,
    plan: paiement.plan,
    cycle: paiement.billingCycle,
    provider: paiement.provider,
    echeanceActuelle: abonnement.currentPeriodEnd,
    maintenant,
  });

  // Le nouveau plan peut ouvrir (ou refermer) des sièges : Clerk doit le
  // savoir, c'est lui qui tient l'écran d'invitation.
  await appliquerLimiteSieges(paiement.organizationId, paiement.plan);

  await prisma.auditLog.create({
    data: {
      organizationId: paiement.organizationId,
      // Aucun utilisateur de l'entreprise n'agit ici : c'est l'éditeur qui
      // valide. Depuis la console, on sait lequel ; depuis la ligne de
      // commande, on ne sait rien de plus que « l'éditeur ».
      actorId: params.actorId ?? "editeur:validation-manuelle",
      entity: "Subscription",
      entityId: abonnement.id,
      action: "PAIEMENT",
      metadata: {
        reference: paiement.reference,
        plan: paiement.plan,
        cycle: paiement.billingCycle,
        montant: paiement.amount,
      },
    },
  });

  return { type: "encaisse" };
}

/**
 * Rejette un paiement : déclaration sans versement correspondant, ou abandon.
 *
 * On ne touche pas au statut de l'abonnement : un échec de souscription laisse
 * l'essai en cours, et un échec de renouvellement est traité par le cron
 * d'échéance, pas ici. Un paiement déjà encaissé n'est pas concerné — le
 * filtre sur les statuts en attente l'exclut.
 */
export async function echouerPaiement(reference: string): Promise<number> {
  // Hors portée : la référence est globalement unique et c'est l'éditeur qui
  // rejette, depuis scripts/valider-paiement.ts. Il ne connaît qu'une
  // référence dictée au téléphone, pas l'entreprise qui l'a émise.
  const { count } = await prismaHorsPortee.payment.updateMany({
    where: {
      reference,
      status: {
        in: [PaymentStatus.PENDING, PaymentStatus.AWAITING_VERIFICATION],
      },
    },
    data: { status: PaymentStatus.FAILED },
  });
  return count;
}
