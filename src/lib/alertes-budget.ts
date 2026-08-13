import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { Role } from "@/generated/prisma/enums";
import { envoyerEmail } from "@/lib/email";
import { formatFCFA } from "@/lib/format";
import { dansLeJournal } from "@/lib/journal";
import { periodeBudget } from "@/lib/periode";
import { prisma } from "@/lib/prisma";

/**
 * Alertes budget à 80 % et 100 % — PROJET.md §4.2 et §9.
 *
 * Le déclencheur est le FRANCHISSEMENT : une dépense n'alerte que si, sans
 * elle, le total était sous le seuil et qu'avec elle il le dépasse. Aucune
 * table d'état « alerte déjà envoyée » : la dépense franchisseuse est unique
 * par construction, les suivantes ne re-déclenchent rien.
 *
 * À appeler APRÈS l'enregistrement de la dépense, hors transaction : un
 * échec d'email ne doit jamais faire échouer une écriture comptable.
 */
export async function verifierAlertesBudget(params: {
  organizationId: string;
  categoryId: string;
  montant: number;
  dateDepense: Date;
}): Promise<void> {
  try {
    // Un budget de catégorie + un budget global peuvent tous deux être
    // concernés par la même dépense.
    const budgets = await prisma.budget.findMany({
      where: {
        organizationId: params.organizationId,
        OR: [{ categoryId: params.categoryId }, { categoryId: null }],
      },
      include: { category: { select: { name: true } } },
    });
    if (budgets.length === 0) return;

    for (const budget of budgets) {
      const periode = periodeBudget(budget.period);
      // Une dépense antidatée hors de la fenêtre courante (rattrapage de
      // récurrence, saisie tardive) ne compte pas dans cette jauge.
      if (
        params.dateDepense < periode.debut ||
        params.dateDepense > periode.fin
      ) {
        continue;
      }

      const somme = await prisma.expense.aggregate({
        where: {
          organizationId: params.organizationId,
          date: { gte: periode.debut, lte: periode.fin },
          ...(budget.categoryId ? { categoryId: budget.categoryId } : {}),
          ...dansLeJournal(),
        },
        _sum: { amount: true },
      });
      const totalApres = somme._sum.amount ?? 0;
      const totalAvant = totalApres - params.montant;

      // Du plus haut au plus bas : si 80 ET 100 sont franchis d'un coup,
      // une seule alerte part — la plus grave.
      const seuils = [...budget.alertThresholds].sort((a, b) => b - a);
      const seuilFranchi = seuils.find((seuil) => {
        const barre = (budget.amount * seuil) / 100;
        return totalAvant < barre && totalApres >= barre;
      });
      if (seuilFranchi === undefined) continue;

      await envoyerAlerte({
        organizationId: params.organizationId,
        nomBudget: budget.category?.name ?? "Budget global",
        periode: budget.period === "MONTHLY" ? "du mois" : "du trimestre",
        seuil: seuilFranchi,
        consomme: totalApres,
        montantBudget: budget.amount,
      });
    }
  } catch (erreur) {
    // Trace sans propager : l'alerte est un signal, pas une écriture.
    console.warn("[alertes-budget] Vérification échouée :", erreur);
  }
}

async function envoyerAlerte(params: {
  organizationId: string;
  nomBudget: string;
  periode: string;
  seuil: number;
  consomme: number;
  montantBudget: number;
}): Promise<void> {
  // Destinataires : gérant + comptable (PROJET.md §9). Les rôles vivent chez
  // nous, les adresses email chez Clerk.
  const adhesions = await prisma.membership.findMany({
    where: {
      organizationId: params.organizationId,
      role: { in: [Role.ADMIN, Role.COMPTABLE] },
    },
    select: { userId: true },
  });
  if (adhesions.length === 0) return;

  const client = await clerkClient();
  const { data: utilisateurs } = await client.users.getUserList({
    userId: adhesions.map((a) => a.userId),
    limit: 100,
  });
  const destinataires = utilisateurs
    .map((u) => u.primaryEmailAddress?.emailAddress)
    .filter((email): email is string => Boolean(email));

  const pourcentage = Math.round(
    (params.consomme / params.montantBudget) * 100,
  );
  const depassement = params.seuil >= 100;

  await envoyerEmail({
    destinataires,
    sujet: depassement
      ? `🔴 Budget dépassé — ${params.nomBudget}`
      : `🟠 Budget à ${params.seuil} % — ${params.nomBudget}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 520px;">
        <h2 style="margin: 0 0 4px;">${depassement ? "Budget dépassé" : `Alerte budget : ${params.seuil} % atteints`}</h2>
        <p style="margin: 0 0 16px; color: #64748b;">${params.nomBudget} — budget ${params.periode}</p>
        <p style="font-size: 24px; margin: 0 0 4px;">
          <strong>${formatFCFA(params.consomme)}</strong>
          <span style="color: #64748b;">sur ${formatFCFA(params.montantBudget)}</span>
        </p>
        <p style="margin: 0 0 20px; color: ${depassement ? "#b91c1c" : "#b45309"};">
          soit ${pourcentage} % du budget ${params.periode}.
        </p>
        <p style="margin: 0; color: #64748b; font-size: 14px;">
          Consultez le détail dans Xaalis → Budgets.
        </p>
      </div>
    `,
  });
}
