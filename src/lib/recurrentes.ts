import "server-only";

import * as z from "zod";
import { PaymentMethod } from "@/generated/prisma/enums";
import { verifierAlertesBudget } from "@/lib/alertes-budget";
import { prisma, prismaHorsPortee } from "@/lib/prisma";

/**
 * Dépenses récurrentes — PROJET.md §4.1 : « loyer, abonnements, générées
 * automatiquement ».
 *
 * Le gabarit vit en Json dans RecurringExpense.template : c'est une dépense
 * sans date, la date étant fournie par chaque échéance. Le Json étant libre
 * en base, il est revalidé ici à chaque lecture — un gabarit corrompu doit
 * être ignoré, pas planter la génération des autres.
 */
export const SchemaGabarit = z.object({
  amount: z.number().int().positive(),
  categoryId: z.string().min(1),
  paymentMethod: z.enum(PaymentMethod),
  supplier: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  // La personne qui a mis en place la récurrence signe les dépenses générées.
  createdById: z.string().min(1),
});

export type Gabarit = z.infer<typeof SchemaGabarit>;

/**
 * Avance d'un nombre de mois en bornant au dernier jour du mois d'arrivée :
 * un loyer du 31 janvier tombe le 28 février puis revient au 31 mars — jamais
 * le 3 mars par débordement silencieux de setMonth.
 *
 * `jourAncrage` porte le jour voulu d'origine : sans lui, itérer depuis le
 * 28 février garderait le 28 pour tous les mois suivants.
 */
export function ajouterMois(
  date: Date,
  nombreMois: number,
  jourAncrage: number = date.getDate(),
): Date {
  const resultat = new Date(date);
  resultat.setDate(1);
  resultat.setMonth(resultat.getMonth() + nombreMois);
  const dernierJour = new Date(
    resultat.getFullYear(),
    resultat.getMonth() + 1,
    0,
  ).getDate();
  resultat.setDate(Math.min(jourAncrage, dernierJour));
  return resultat;
}

const MOIS_PAR_FREQUENCE = { MENSUELLE: 1, TRIMESTRIELLE: 3 } as const;

/**
 * Génère les dépenses de toutes les échéances arrivées, tous tenants
 * confondus : c'est le cron qui appelle, pas une session.
 *
 * Chaque échéance manquée produit sa dépense, datée du jour où elle aurait
 * dû tomber : si le cron a raté trois mois, le journal comptable retrouve
 * ses trois loyers — un journal troué vaudrait pire qu'un rattrapage tardif.
 */
export async function genererDepensesEchues(): Promise<{
  generees: number;
  ignorees: number;
}> {
  const maintenant = new Date();
  // Hors portée : le cron des récurrences génère les dépenses dues de toutes
  // les entreprises en une passe. C'est un balayage global par construction.
  const echues = await prismaHorsPortee.recurringExpense.findMany({
    where: { active: true, nextRunAt: { lte: maintenant } },
  });

  let generees = 0;
  let ignorees = 0;

  for (const recurrence of echues) {
    const gabarit = SchemaGabarit.safeParse(recurrence.template);
    if (!gabarit.success) {
      ignorees += 1;
      continue;
    }

    // La catégorie peut avoir disparu depuis la mise en place : dans ce cas
    // la récurrence est ignorée aujourd'hui, l'interface permettra de la
    // corriger — générer une dépense sans catégorie casserait le journal.
    const categorie = await prisma.category.findFirst({
      where: {
        id: gabarit.data.categoryId,
        organizationId: recurrence.organizationId,
      },
      select: { id: true },
    });
    if (!categorie) {
      ignorees += 1;
      continue;
    }

    const pasEnMois = MOIS_PAR_FREQUENCE[recurrence.frequency];
    const jourAncrage = recurrence.nextRunAt.getDate();
    let echeance = recurrence.nextRunAt;
    const echeancesGenerees: Date[] = [];

    // Une transaction par récurrence : si l'une échoue, les autres
    // entreprises reçoivent quand même leurs dépenses du jour.
    await prisma.$transaction(async (tx) => {
      while (echeance <= maintenant) {
        const depense = await tx.expense.create({
          data: {
            organizationId: recurrence.organizationId,
            amount: gabarit.data.amount,
            date: echeance,
            categoryId: gabarit.data.categoryId,
            paymentMethod: gabarit.data.paymentMethod,
            supplier: gabarit.data.supplier,
            description: gabarit.data.description,
            createdById: gabarit.data.createdById,
          },
          select: { id: true },
        });

        await tx.auditLog.create({
          data: {
            organizationId: recurrence.organizationId,
            actorId: gabarit.data.createdById,
            entity: "Expense",
            entityId: depense.id,
            action: "GENERATION_RECURRENTE",
            metadata: {
              recurringExpenseId: recurrence.id,
              echeance: echeance.toISOString(),
            },
          },
        });

        generees += 1;
        echeancesGenerees.push(echeance);
        echeance = ajouterMois(echeance, pasEnMois, jourAncrage);
      }

      await tx.recurringExpense.update({
        where: { id: recurrence.id },
        data: { nextRunAt: echeance },
      });
    });

    // Hors transaction : les loyers générés consomment les budgets comme
    // toute dépense — mêmes alertes, mêmes règles de franchissement.
    // Cas limite assumé (v1) : un rattrapage de plusieurs échéances dans la
    // même période d'un budget trimestriel peut dupliquer l'alerte, les
    // sommes étant déjà toutes en base au moment des vérifications.
    for (const dateEcheance of echeancesGenerees) {
      await verifierAlertesBudget({
        organizationId: recurrence.organizationId,
        categoryId: gabarit.data.categoryId,
        montant: gabarit.data.amount,
        dateDepense: dateEcheance,
      });
    }
  }

  return { generees, ignorees };
}
