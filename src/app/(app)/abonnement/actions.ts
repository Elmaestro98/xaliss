"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { BillingCycle, SubscriptionPlan } from "@/generated/prisma/enums";
import { declarerPaiement, lancerPaiement } from "@/lib/facturation";
import { paiementConfigure } from "@/lib/lien-wave";
import { assertCan } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const SchemaSouscription = z.object({
  plan: z.enum(SubscriptionPlan, { error: "Choisissez un plan." }),
  cycle: z.enum(BillingCycle, { error: "Choisissez une périodicité." }),
});

export type EtatFormulaire = {
  erreurs?: Record<string, string[]>;
  message?: string;
};

/**
 * Souscription ou changement de plan (PROJET.md §4.5).
 *
 * Le formulaire ne transmet que le plan et la périodicité : le montant est
 * recalculé côté serveur depuis le catalogue (lib/facturation.ts). Un champ
 * caché trafiqué n'achète donc pas un plan Business au tarif Starter.
 *
 * Rien n'est activé ici. L'action inscrit ce qui est attendu, puis conduit à
 * la page qui dicte le montant et le lien Wave.
 */
export async function souscrire(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const session = await requireSession();
  assertCan(session.role, "subscription:manage");

  // Sans lien configuré, échouer franchement plutôt que d'envoyer le gérant
  // vers une page qui ne mène nulle part.
  if (!paiementConfigure) {
    return {
      message:
        "Le paiement n'est pas encore configuré. Contactez le support pour souscrire.",
    };
  }

  const resultat = SchemaSouscription.safeParse({
    plan: donnees.get("plan"),
    cycle: donnees.get("cycle"),
  });
  if (!resultat.success) {
    return {
      erreurs: z.flattenError(resultat.error).fieldErrors,
      message: "Vérifiez le plan et la périodicité choisis.",
    };
  }

  const paiement = await lancerPaiement({
    organizationId: session.organizationId,
    plan: resultat.data.plan,
    cycle: resultat.data.cycle,
  });

  await prisma.auditLog.create({
    data: {
      organizationId: session.organizationId,
      actorId: session.userId,
      entity: "Payment",
      entityId: paiement.id,
      action: "PAIEMENT_LANCE",
      metadata: {
        reference: paiement.reference,
        plan: resultat.data.plan,
        cycle: resultat.data.cycle,
        montant: paiement.amount,
      },
    },
  });

  // Hors de tout try : redirect() signale la redirection en levant une
  // exception, qu'un catch avalerait.
  redirect(`/abonnement/paiement/${paiement.reference}`);
}

const SchemaDeclaration = z.object({
  // Les reçus Wave portent un identifiant court (TAxxxxxxxxx). On l'accepte
  // largement : refuser un format légitime bloquerait un vrai paiement, et
  // cette valeur ne sert de toute façon qu'à retrouver le versement à la main.
  transactionId: z
    .string()
    .trim()
    .min(4, "Recopiez l'identifiant figurant sur votre reçu Wave.")
    .max(64, "Cet identifiant est trop long."),
});

/**
 * « J'ai payé » : le gérant déclare son versement et recopie l'identifiant de
 * son reçu Wave.
 *
 * Ne donne accès à rien. La déclaration passe le paiement en attente de
 * vérification ; l'abonnement ne s'active qu'une fois l'argent constaté sur le
 * portefeuille marchand (`scripts/valider-paiement.ts`).
 */
export async function declarerAvoirPaye(
  reference: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const session = await requireSession();
  assertCan(session.role, "subscription:manage");

  const resultat = SchemaDeclaration.safeParse({
    transactionId: donnees.get("transactionId"),
  });
  if (!resultat.success) {
    return { erreurs: z.flattenError(resultat.error).fieldErrors };
  }

  const declaration = await declarerPaiement({
    organizationId: session.organizationId,
    reference,
    transactionId: resultat.data.transactionId,
  });

  if (declaration.type === "introuvable") {
    return { message: "Ce paiement est introuvable." };
  }
  if (declaration.type === "deja-encaisse") {
    return { message: "Ce paiement a déjà été encaissé." };
  }

  revalidatePath("/abonnement");
  revalidatePath(`/abonnement/paiement/${reference}`);
  return { message: "Déclaration enregistrée." };
}
