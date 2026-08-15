import "server-only";

import type { SubscriptionPlan } from "@/generated/prisma/enums";
import { AbonnementError } from "@/lib/abonnement";
import { periodeCourante } from "@/lib/periode";
import { formatQuota, PLANS, quotaDepasse } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

/**
 * Quotas mensuels — PROJET.md §11.
 *
 * Les compteurs sont calculés sur le mois civil en cours et remis à zéro par
 * le calendrier, pas par une tâche de fond : rien à planifier, rien qui puisse
 * échouer silencieusement.
 *
 * On mesure la consommation à la **création** (`createdAt`), jamais à la date
 * comptable de la dépense : sans cela, il suffirait d'antidater une dépense au
 * mois dernier pour contourner la limite.
 */

async function consommationDepenses(
  organizationId: string,
  maintenant = new Date(),
): Promise<number> {
  const { debut } = periodeCourante(maintenant);
  return prisma.expense.count({
    where: { organizationId, createdAt: { gte: debut } },
  });
}

async function consommationOcr(
  organizationId: string,
  maintenant = new Date(),
): Promise<number> {
  const { debut } = periodeCourante(maintenant);
  return prisma.ocrUsage.count({
    where: { organizationId, createdAt: { gte: debut } },
  });
}

/** Le nom du plan qui débloque la suite, pour un message utile. */
function planSuivant(plan: SubscriptionPlan): string {
  return plan === "STARTER" ? "Pro" : "Business";
}

export async function assertQuotaDepenses(
  plan: SubscriptionPlan,
  organizationId: string,
): Promise<void> {
  const quota = PLANS[plan].depensesParMois;
  const consommation = await consommationDepenses(organizationId);

  if (quotaDepasse(quota, consommation)) {
    throw new AbonnementError(
      `Votre plan ${PLANS[plan].nom} est limité à ${formatQuota(quota)} dépenses par mois, et vous y êtes. Passez au plan ${planSuivant(plan)} pour continuer à saisir ce mois-ci.`,
      "quota",
    );
  }
}

export async function assertQuotaOcr(
  plan: SubscriptionPlan,
  organizationId: string,
): Promise<void> {
  const quota = PLANS[plan].ocrParMois;
  const consommation = await consommationOcr(organizationId);

  if (quotaDepasse(quota, consommation)) {
    throw new AbonnementError(
      `Votre plan ${PLANS[plan].nom} est limité à ${formatQuota(quota)} scans par mois. Saisissez la dépense à la main, ou passez au plan ${planSuivant(plan)}.`,
      "quota",
    );
  }
}

/**
 * Enregistre un appel OCR consommé.
 *
 * Posé APRÈS un appel réussi à Gemini : une panne du service ne doit pas
 * amputer le quota du client de ce qu'il n'a pas obtenu.
 */
export async function enregistrerUsageOcr(params: {
  organizationId: string;
  userId: string;
}): Promise<void> {
  await prisma.ocrUsage.create({
    data: { organizationId: params.organizationId, userId: params.userId },
  });
}

/** Ce que la page Abonnement affiche : où en est la consommation du mois. */
export async function releveConsommation(
  plan: SubscriptionPlan,
  organizationId: string,
) {
  const [depenses, ocr] = await Promise.all([
    consommationDepenses(organizationId),
    consommationOcr(organizationId),
  ]);

  return {
    depenses: { consomme: depenses, quota: PLANS[plan].depensesParMois },
    ocr: { consomme: ocr, quota: PLANS[plan].ocrParMois },
  };
}
