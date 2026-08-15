import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import {
  BillingCycle,
  SubscriptionPlan,
  SubscriptionStatus,
} from "@/generated/prisma/enums";
import type { Subscription } from "@/generated/prisma/client";
import {
  estIllimite,
  JOURS_DE_GRACE,
  JOURS_ESSAI,
  PLAN_PAR_DEFAUT,
  PLANS,
  type Fonctionnalite,
  planPermet,
} from "@/lib/plans";
import { prisma } from "@/lib/prisma";

/**
 * Cycle de vie de l'abonnement — PROJET.md §9 et §11.
 *
 * L'entreprise démarre en essai gratuit, paie, et l'abonnement se renouvelle.
 * Si un renouvellement échoue, elle garde 7 jours d'accès complet — le délai
 * de grâce — avant de basculer en lecture seule. Jamais de suppression :
 * un registre comptable reste consultable même impayé, comme pour la
 * suppression d'entreprise (PROJET.md §6).
 */

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

/**
 * Ajoute des mois en calant le jour sur la fin du mois quand il n'existe pas :
 * un abonnement souscrit le 31 janvier échoit le 28 février, pas le 3 mars.
 * Sans ce calage, JavaScript déborde silencieusement sur le mois suivant et
 * l'échéance dérive à chaque renouvellement.
 *
 * Conséquence assumée : le calage ne se « déjoue » pas. Une échéance ramenée
 * au 28 février y reste les mois suivants, elle ne remonte pas au 31. Le jour
 * de facturation ne peut donc que reculer, jamais avancer — c'est le sens
 * favorable au client, et il évite d'avoir à mémoriser un jour d'ancrage.
 */
function ajouterMois(depuis: Date, mois: number): Date {
  const cible = new Date(depuis);
  const jour = cible.getDate();
  cible.setDate(1);
  cible.setMonth(cible.getMonth() + mois);
  const dernierJour = new Date(
    cible.getFullYear(),
    cible.getMonth() + 1,
    0,
  ).getDate();
  cible.setDate(Math.min(jour, dernierJour));
  return cible;
}

export function finDePeriode(cycle: BillingCycle, depuis: Date): Date {
  return ajouterMois(depuis, cycle === BillingCycle.YEARLY ? 12 : 1);
}

function joursRestants(echeance: Date, maintenant: Date): number {
  return Math.max(
    0,
    Math.ceil((echeance.getTime() - maintenant.getTime()) / MS_PAR_JOUR),
  );
}

/**
 * L'état lisible d'un abonnement. Un type par situation plutôt qu'un statut
 * brut : l'interface et les garde-fous ont besoin de savoir *combien de jours
 * il reste*, pas seulement que le statut vaut PAST_DUE.
 */
export type EtatAbonnement =
  | { type: "essai"; plan: SubscriptionPlan; fin: Date; joursRestants: number }
  | {
      type: "actif";
      plan: SubscriptionPlan;
      cycle: BillingCycle;
      fin: Date;
    }
  | {
      type: "impaye";
      plan: SubscriptionPlan;
      suspensionLe: Date;
      joursRestants: number;
    }
  | { type: "suspendu"; plan: SubscriptionPlan }
  | { type: "resilie"; plan: SubscriptionPlan };

export function etatAbonnement(
  abonnement: Subscription,
  maintenant = new Date(),
): EtatAbonnement {
  const plan = abonnement.plan;

  switch (abonnement.status) {
    case SubscriptionStatus.TRIALING:
      return {
        type: "essai",
        plan,
        fin: abonnement.currentPeriodEnd,
        joursRestants: joursRestants(abonnement.currentPeriodEnd, maintenant),
      };

    case SubscriptionStatus.ACTIVE:
      return {
        type: "actif",
        plan,
        cycle: abonnement.billingCycle,
        fin: abonnement.currentPeriodEnd,
      };

    case SubscriptionStatus.PAST_DUE: {
      // Une entrée en PAST_DUE sans date de grâce ne devrait pas exister ;
      // si elle survient, on accorde le délai plutôt que de couper l'accès.
      const suspensionLe =
        abonnement.graceEndsAt ??
        new Date(
          abonnement.currentPeriodEnd.getTime() + JOURS_DE_GRACE * MS_PAR_JOUR,
        );
      return {
        type: "impaye",
        plan,
        suspensionLe,
        joursRestants: joursRestants(suspensionLe, maintenant),
      };
    }

    case SubscriptionStatus.SUSPENDED:
      return { type: "suspendu", plan };

    case SubscriptionStatus.CANCELED:
      return { type: "resilie", plan };
  }
}

/**
 * Pendant le délai de grâce, l'entreprise écrit encore : c'est tout l'intérêt
 * du délai. Seules la suspension et la résiliation ferment l'écriture.
 */
export function estEnLectureSeule(etat: EtatAbonnement): boolean {
  return etat.type === "suspendu" || etat.type === "resilie";
}

/**
 * Récupère l'abonnement, et démarre l'essai s'il manque.
 *
 * Ce filet vaut pour les entreprises créées avant l'arrivée de ce module, et
 * pour le cas — rare — où la création d'entreprise n'aurait pas posé l'essai.
 * Même esprit que la synchro à la volée de `getSession()` (lib/sync-clerk.ts) :
 * une donnée d'infrastructure manquante ne doit empêcher personne de
 * travailler.
 */
export async function getAbonnement(
  organizationId: string,
): Promise<Subscription> {
  const existant = await prisma.subscription.findUnique({
    where: { organizationId },
  });
  if (existant) return existant;

  return prisma.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      plan: PLAN_PAR_DEFAUT,
      status: SubscriptionStatus.TRIALING,
      currentPeriodEnd: dateFinEssai(),
    },
    update: {},
  });
}

/** L'échéance d'un essai qui démarrerait maintenant. */
export function dateFinEssai(depuis = new Date()): Date {
  return new Date(depuis.getTime() + JOURS_ESSAI * MS_PAR_JOUR);
}

/** Raccourci des actions serveur : l'état d'abonnement de l'entreprise. */
export async function etatCourant(
  organizationId: string,
): Promise<EtatAbonnement> {
  return etatAbonnement(await getAbonnement(organizationId));
}

/**
 * Reporte la limite d'utilisateurs du plan sur l'organisation Clerk.
 *
 * Les invitations sont émises par l'interface de Clerk (PROJET.md §6) : c'est
 * donc Clerk qui doit connaître le nombre de sièges, sinon la limite ne serait
 * qu'un affichage que l'écran d'invitation ignorerait. `0` signifie illimité
 * dans son API.
 *
 * Un échec est tracé sans interrompre : c'est une limite commerciale, pas une
 * frontière de sécurité, et elle sera rappliquée au paiement suivant.
 *
 * ⚠️ On relit la valeur avant d'écrire, et pas seulement par économie : mettre
 * à jour l'organisation fait émettre à Clerk un `organization.updated`, que
 * notre webhook traite en rappelant cette fonction. Sans cette comparaison,
 * les deux se relanceraient indéfiniment.
 */
export async function appliquerLimiteSieges(
  organizationId: string,
  plan: SubscriptionPlan,
): Promise<void> {
  const sieges = PLANS[plan].utilisateurs;
  const voulu = estIllimite(sieges) ? 0 : sieges;

  try {
    const client = await clerkClient();
    const organisation = await client.organizations.getOrganization({
      organizationId,
    });
    if (organisation.maxAllowedMemberships === voulu) return;

    await client.organizations.updateOrganization(organizationId, {
      maxAllowedMemberships: voulu,
    });
  } catch (erreur) {
    console.warn(
      "[abonnement] Limite de sièges non appliquée pour",
      organizationId,
      erreur,
    );
  }
}

// ─────────────────────────────────────────────────────────
// Garde-fous — à appeler dans toute action serveur qui écrit
// ─────────────────────────────────────────────────────────

/** Écriture refusée : l'abonnement ne le permet plus. */
export class AbonnementError extends Error {
  constructor(
    message: string,
    /** Ce que l'interface doit proposer : payer, ou changer de plan. */
    readonly raison: "lecture-seule" | "fonctionnalite" | "quota",
  ) {
    super(message);
    this.name = "AbonnementError";
  }
}

export function assertPeutEcrire(etat: EtatAbonnement): void {
  if (estEnLectureSeule(etat)) {
    throw new AbonnementError(
      "Votre abonnement est suspendu : Xaalis est en lecture seule. Régularisez le paiement pour réactiver la saisie.",
      "lecture-seule",
    );
  }
}

export function assertFonctionnalite(
  plan: SubscriptionPlan,
  fonctionnalite: Fonctionnalite,
): void {
  if (!planPermet(plan, fonctionnalite)) {
    throw new AbonnementError(
      LIBELLES_FONCTIONNALITE[fonctionnalite],
      "fonctionnalite",
    );
  }
}

const LIBELLES_FONCTIONNALITE: Record<Fonctionnalite, string> = {
  "notes-de-frais":
    "Les notes de frais sont incluses à partir du plan Pro. Changez de plan pour les activer.",
  "alertes-sms":
    "Les alertes SMS sont incluses à partir du plan Pro. Changez de plan pour les activer.",
  "export-excel":
    "L'export Excel est inclus à partir du plan Pro. L'export PDF reste disponible sur votre plan.",
};

// ─────────────────────────────────────────────────────────
// Transitions
// ─────────────────────────────────────────────────────────

/**
 * Un paiement encaissé active l'abonnement et repousse l'échéance.
 *
 * La nouvelle période part de l'échéance en cours si elle est encore devant
 * nous : payer trois jours en avance ne doit pas faire perdre ces trois jours.
 * Elle part de maintenant si l'échéance est passée.
 */
export async function activerApresPaiement(params: {
  subscriptionId: string;
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  provider: Subscription["provider"];
  echeanceActuelle: Date;
  maintenant?: Date;
}): Promise<Subscription> {
  const maintenant = params.maintenant ?? new Date();
  const depart =
    params.echeanceActuelle > maintenant ? params.echeanceActuelle : maintenant;

  return prisma.subscription.update({
    where: { id: params.subscriptionId },
    data: {
      plan: params.plan,
      billingCycle: params.cycle,
      provider: params.provider,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: finDePeriode(params.cycle, depart),
      graceEndsAt: null,
    },
  });
}

/** Échéance atteinte sans paiement : le délai de grâce démarre. */
export async function marquerImpaye(
  subscriptionId: string,
  maintenant = new Date(),
): Promise<Subscription> {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.PAST_DUE,
      graceEndsAt: new Date(maintenant.getTime() + JOURS_DE_GRACE * MS_PAR_JOUR),
    },
  });
}

/** Délai de grâce écoulé : passage en lecture seule. */
export async function suspendre(
  subscriptionId: string,
): Promise<Subscription> {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: SubscriptionStatus.SUSPENDED },
  });
}
