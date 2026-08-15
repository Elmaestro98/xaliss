import { BillingCycle, SubscriptionPlan } from "@/generated/prisma/enums";

/**
 * Catalogue des plans — PROJET.md §11.
 *
 * Ce fichier est la seule source de vérité des tarifs et des quotas. Il ne
 * dépend de rien : ni base, ni session. C'est voulu, la grille tarifaire doit
 * pouvoir s'afficher sur la page publique comme se vérifier côté serveur.
 *
 * À ne pas confondre avec `lib/permissions.ts` : celui-ci répond « ce rôle
 * a-t-il le droit ? », celui-là « l'entreprise a-t-elle payé pour ça ? ».
 * Les deux se cumulent — un ADMIN d'un plan STARTER n'accède pas aux notes
 * de frais, et un EMPLOYE d'un plan BUSINESS n'approuve toujours rien.
 */

/** Un quota absent de la grille est illimité, pas égal à zéro. */
export type Quota = number | "illimite";

export type Fonctionnalite = "notes-de-frais" | "alertes-sms" | "export-excel";

export type Plan = {
  code: SubscriptionPlan;
  nom: string;
  /** FCFA par mois, entier (PROJET.md §6) */
  prixMensuel: number;
  argumentaire: string;
  utilisateurs: Quota;
  depensesParMois: Quota;
  ocrParMois: Quota;
  fonctionnalites: readonly Fonctionnalite[];
  support: string;
};

export const PLANS: Record<SubscriptionPlan, Plan> = {
  [SubscriptionPlan.STARTER]: {
    code: SubscriptionPlan.STARTER,
    nom: "Starter",
    prixMensuel: 12_500,
    argumentaire: "Pour une petite équipe qui veut arrêter le cahier papier.",
    utilisateurs: 3,
    depensesParMois: 150,
    ocrParMois: 20,
    fonctionnalites: [],
    support: "Email",
  },
  [SubscriptionPlan.PRO]: {
    code: SubscriptionPlan.PRO,
    nom: "Pro",
    prixMensuel: 30_000,
    argumentaire: "Pour une entreprise qui rembourse des notes de frais.",
    utilisateurs: 10,
    depensesParMois: "illimite",
    ocrParMois: 200,
    fonctionnalites: ["notes-de-frais", "alertes-sms", "export-excel"],
    support: "Email + WhatsApp",
  },
  [SubscriptionPlan.BUSINESS]: {
    code: SubscriptionPlan.BUSINESS,
    nom: "Business",
    prixMensuel: 60_000,
    argumentaire: "Pour une entreprise sans limite d'effectif ni de volume.",
    utilisateurs: "illimite",
    depensesParMois: "illimite",
    ocrParMois: "illimite",
    fonctionnalites: ["notes-de-frais", "alertes-sms", "export-excel"],
    support: "Prioritaire + onboarding",
  },
};

/** Du moins cher au plus cher — l'ordre d'affichage de la grille. */
export const PLANS_ORDONNES: readonly Plan[] = [
  PLANS[SubscriptionPlan.STARTER],
  PLANS[SubscriptionPlan.PRO],
  PLANS[SubscriptionPlan.BUSINESS],
];

/** Le plan proposé par défaut, et celui de l'essai gratuit. */
export const PLAN_PAR_DEFAUT = SubscriptionPlan.PRO;

export const JOURS_ESSAI = 14;

/** Après un paiement manqué, avant le passage en lecture seule (PROJET.md §9). */
export const JOURS_DE_GRACE = 7;

/** « Paiement annuel : 2 mois offerts » — on facture donc 10 mois sur 12. */
export const MOIS_OFFERTS_ANNUEL = 2;
const MOIS_FACTURES_ANNUEL = 12 - MOIS_OFFERTS_ANNUEL;

export function prixPour(plan: SubscriptionPlan, cycle: BillingCycle): number {
  const mensuel = PLANS[plan].prixMensuel;
  return cycle === BillingCycle.YEARLY
    ? mensuel * MOIS_FACTURES_ANNUEL
    : mensuel;
}

/** Ce que le client économise en payant à l'année, en FCFA. */
export function economieAnnuelle(plan: SubscriptionPlan): number {
  return PLANS[plan].prixMensuel * MOIS_OFFERTS_ANNUEL;
}

export function planPermet(
  plan: SubscriptionPlan,
  fonctionnalite: Fonctionnalite,
): boolean {
  return PLANS[plan].fonctionnalites.includes(fonctionnalite);
}

export function estIllimite(quota: Quota): quota is "illimite" {
  return quota === "illimite";
}

/**
 * `consommation` est le nombre d'unités DÉJÀ utilisées. La comparaison est
 * donc `>=` : à 150 dépenses consommées sur un quota de 150, la 151e est
 * refusée.
 */
export function quotaDepasse(quota: Quota, consommation: number): boolean {
  return estIllimite(quota) ? false : consommation >= quota;
}

/** « 150 » ou « Illimité », pour l'affichage. */
export function formatQuota(quota: Quota): string {
  return estIllimite(quota) ? "Illimité" : quota.toLocaleString("fr-FR");
}
