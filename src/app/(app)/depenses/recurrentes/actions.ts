"use server";

import { revalidatePath } from "next/cache";
import { avecSucces } from "@/lib/messages-succes";
import { redirect } from "next/navigation";
import * as z from "zod";
import { PaymentMethod, RecurringFrequency } from "@/generated/prisma/enums";
import { assertCan } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import type { Gabarit } from "@/lib/recurrentes";
import { requireSession } from "@/lib/session";

const SchemaRecurrence = z.object({
  amount: z.coerce
    .number({ error: "Indiquez un montant." })
    .int("Le franc CFA n'a pas de centimes : saisissez un montant entier.")
    .positive("Le montant doit être supérieur à zéro.")
    .max(999_999_999_999, "Ce montant dépasse la limite."),
  categoryId: z.string().min(1, "Choisissez une catégorie."),
  paymentMethod: z.enum(PaymentMethod, {
    error: "Choisissez un moyen de paiement.",
  }),
  frequency: z.enum(RecurringFrequency, {
    error: "Choisissez une fréquence.",
  }),
  premiereEcheance: z.coerce.date({ error: "Indiquez la première échéance." }),
  supplier: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
});

export type EtatFormulaire = {
  erreurs?: Record<string, string[]>;
  message?: string;
};

export async function creerRecurrence(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const session = await requireSession();
  assertCan(session.role, "expenses:write");

  const resultat = SchemaRecurrence.safeParse({
    amount: donnees.get("amount"),
    categoryId: donnees.get("categoryId"),
    paymentMethod: donnees.get("paymentMethod"),
    frequency: donnees.get("frequency"),
    premiereEcheance: donnees.get("premiereEcheance"),
    supplier: donnees.get("supplier") || undefined,
    description: donnees.get("description") || undefined,
  });

  if (!resultat.success) {
    return {
      erreurs: z.flattenError(resultat.error).fieldErrors,
      message: "Vérifiez les champs signalés.",
    };
  }

  // Même contrôle que pour une dépense : la catégorie doit être à nous.
  const categorie = await prisma.category.findFirst({
    where: {
      id: resultat.data.categoryId,
      organizationId: session.organizationId,
    },
    select: { id: true },
  });
  if (!categorie) {
    return { erreurs: { categoryId: ["Cette catégorie n'existe pas."] } };
  }

  // Le gabarit est typé à l'écriture (Gabarit) : la relecture côté cron le
  // revalide quand même, le Json de la base ne prouvant rien à lui seul.
  const gabarit: Gabarit = {
    amount: resultat.data.amount,
    categoryId: resultat.data.categoryId,
    paymentMethod: resultat.data.paymentMethod,
    supplier: resultat.data.supplier,
    description: resultat.data.description,
    createdById: session.userId,
  };

  const recurrence = await prisma.recurringExpense.create({
    data: {
      organizationId: session.organizationId,
      template: gabarit,
      frequency: resultat.data.frequency,
      nextRunAt: resultat.data.premiereEcheance,
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: session.organizationId,
      actorId: session.userId,
      entity: "RecurringExpense",
      entityId: recurrence.id,
      action: "CREATION",
      metadata: { amount: resultat.data.amount },
    },
  });

  revalidatePath("/depenses/recurrentes");
  redirect(avecSucces("/depenses/recurrentes", "recurrence-creee"));
}

/** Met en pause ou réactive une récurrence, sans la supprimer. */
export async function basculerRecurrence(id: string): Promise<void> {
  const session = await requireSession();
  assertCan(session.role, "expenses:write");

  // findFirst borné au tenant : un identifiant d'une autre entreprise est
  // introuvable, l'action s'arrête là.
  const recurrence = await prisma.recurringExpense.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, active: true },
  });
  if (!recurrence) return;

  await prisma.recurringExpense.update({
    where: { id: recurrence.id },
    data: { active: !recurrence.active },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: session.organizationId,
      actorId: session.userId,
      entity: "RecurringExpense",
      entityId: recurrence.id,
      action: recurrence.active ? "MISE_EN_PAUSE" : "REACTIVATION",
      metadata: {},
    },
  });

  revalidatePath("/depenses/recurrentes");
}
