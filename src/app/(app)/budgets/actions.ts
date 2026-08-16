"use server";

import { revalidatePath } from "next/cache";
import { avecSucces } from "@/lib/messages-succes";
import { redirect } from "next/navigation";
import * as z from "zod";
import { BudgetPeriod } from "@/generated/prisma/enums";
import { lireSeuilAlerte, seuilsDepuisAlerte } from "@/lib/parametres";
import { assertCan } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

/**
 * Valeur sentinelle du select catégorie : budget global si choisie.
 * Dupliquée dans formulaire-budget.tsx — un fichier "use server" ne peut
 * exporter que des fonctions async, pas de constantes.
 */
const BUDGET_GLOBAL = "global";

const SchemaBudget = z.object({
  amount: z.coerce
    .number({ error: "Indiquez un montant." })
    .int("Le franc CFA n'a pas de centimes : saisissez un montant entier.")
    .positive("Le montant doit être supérieur à zéro.")
    .max(999_999_999_999, "Ce montant dépasse la limite."),
  period: z.enum(BudgetPeriod, { error: "Choisissez une période." }),
  categoryId: z.string().min(1, "Choisissez une catégorie."),
});

export type EtatFormulaire = {
  erreurs?: Record<string, string[]>;
  message?: string;
};

export async function creerBudget(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const session = await requireSession();
  assertCan(session.role, "budgets:manage");

  const resultat = SchemaBudget.safeParse({
    amount: donnees.get("amount"),
    period: donnees.get("period"),
    categoryId: donnees.get("categoryId"),
  });
  if (!resultat.success) {
    return {
      erreurs: z.flattenError(resultat.error).fieldErrors,
      message: "Vérifiez les champs signalés.",
    };
  }

  // La sentinelle « global » devient null en base : Budget.categoryId nullable
  // = budget sur toutes les catégories (PROJET.md §7).
  const categoryId =
    resultat.data.categoryId === BUDGET_GLOBAL ? null : resultat.data.categoryId;

  if (categoryId) {
    const categorie = await prisma.category.findFirst({
      where: { id: categoryId, organizationId: session.organizationId },
      select: { id: true },
    });
    if (!categorie) {
      return { erreurs: { categoryId: ["Cette catégorie n'existe pas."] } };
    }
  }

  // Deux budgets sur la même cible sèmeraient la confusion dans les jauges
  // et les alertes : une cible, un budget — on modifie plutôt qu'on empile.
  const doublon = await prisma.budget.findFirst({
    where: { organizationId: session.organizationId, categoryId },
    select: { id: true },
  });
  if (doublon) {
    return {
      erreurs: {
        categoryId: [
          categoryId
            ? "Un budget existe déjà pour cette catégorie. Supprimez-le d'abord."
            : "Un budget global existe déjà. Supprimez-le d'abord.",
        ],
      },
    };
  }

  // Un nouveau budget adopte le seuil d'alerte de l'entreprise (Paramètres).
  const organisation = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { settings: true },
  });
  const alertThresholds = seuilsDepuisAlerte(
    lireSeuilAlerte(organisation?.settings),
  );

  const budget = await prisma.budget.create({
    data: {
      organizationId: session.organizationId,
      categoryId,
      amount: resultat.data.amount,
      period: resultat.data.period,
      alertThresholds,
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: session.organizationId,
      actorId: session.userId,
      entity: "Budget",
      entityId: budget.id,
      action: "CREATION",
      metadata: { amount: resultat.data.amount, period: resultat.data.period },
    },
  });

  revalidatePath("/budgets");
  redirect(avecSucces("/budgets", "budget-cree"));
}

export async function supprimerBudget(id: string): Promise<void> {
  const session = await requireSession();
  assertCan(session.role, "budgets:manage");

  // deleteMany borné au tenant : un identifiant étranger ne supprime rien.
  const resultat = await prisma.budget.deleteMany({
    where: { id, organizationId: session.organizationId },
  });

  if (resultat.count > 0) {
    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorId: session.userId,
        entity: "Budget",
        entityId: id,
        action: "SUPPRESSION",
        metadata: {},
      },
    });
  }

  revalidatePath("/budgets");
}
