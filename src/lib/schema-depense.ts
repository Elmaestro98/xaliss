import * as z from "zod";
import { PaymentMethod } from "@/generated/prisma/enums";

/**
 * Partagé entre la saisie directe (depenses/actions.ts) et l'ajout d'une
 * dépense à une note de frais (notes-de-frais/actions.ts) : même dépense,
 * deux portes d'entrée.
 */
export const SchemaDepense = z.object({
  // Les montants sont des entiers de FCFA : pas de décimales (PROJET.md §6).
  amount: z.coerce
    .number({ error: "Indiquez un montant." })
    .int("Le franc CFA n'a pas de centimes : saisissez un montant entier.")
    .positive("Le montant doit être supérieur à zéro.")
    .max(999_999_999_999, "Ce montant dépasse la limite."),
  date: z.coerce.date({ error: "Indiquez une date." }),
  categoryId: z.string().min(1, "Choisissez une catégorie."),
  paymentMethod: z.enum(PaymentMethod, {
    error: "Choisissez un moyen de paiement.",
  }),
  supplier: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
});
