import { PaymentMethod } from "@/generated/prisma/enums";

/**
 * Les moyens de paiement sont des données, pas du décor : leurs couleurs sont
 * celles des marques réelles (Wave, Orange Money). C'est pour les laisser
 * parler que le reste de l'interface reste sobre. Voir globals.css.
 */
export const MOYENS_PAIEMENT: Record<
  PaymentMethod,
  { libelle: string; couleur: string }
> = {
  [PaymentMethod.ESPECES]: { libelle: "Espèces", couleur: "var(--pm-especes)" },
  [PaymentMethod.WAVE]: { libelle: "Wave", couleur: "var(--pm-wave)" },
  [PaymentMethod.ORANGE_MONEY]: {
    libelle: "Orange Money",
    couleur: "var(--pm-orange-money)",
  },
  [PaymentMethod.VIREMENT]: {
    libelle: "Virement",
    couleur: "var(--pm-virement)",
  },
  [PaymentMethod.CARTE]: { libelle: "Carte", couleur: "var(--pm-carte)" },
};

export const ROLES = {
  ADMIN: "Gérant",
  COMPTABLE: "Comptable",
  EMPLOYE: "Employé",
} as const;
