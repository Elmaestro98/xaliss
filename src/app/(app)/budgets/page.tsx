import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormulaireBudget } from "@/components/formulaire-budget";
import { PastilleStatut } from "@/components/pastille-statut";
import { capitaliser, formatFCFA, formatMois } from "@/lib/format";
import { dansLeJournal } from "@/lib/journal";
import { lireSeuilAlerte } from "@/lib/parametres";
import { can } from "@/lib/permissions";
import { periodeBudget } from "@/lib/periode";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { supprimerBudget } from "./actions";

const LIBELLES_PERIODE = { MONTHLY: "ce mois", QUARTERLY: "ce trimestre" } as const;

export default async function BudgetsPage() {
  const session = await requireSession();

  // Même frontière que la navigation : la page refuse d'elle-même, le menu
  // ne fait que masquer (PROJET.md §5).
  if (!can(session.role, "budgets:manage")) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 md:px-8">
        <h1 className="titre text-2xl">Réservé à la gestion</h1>
        <p className="mt-3 text-muted-foreground">
          Les budgets sont définis par le gérant ou le comptable de
          l&apos;entreprise.
        </p>
        <Link
          href="/depenses"
          className="mt-6 inline-block text-sm text-indigo underline underline-offset-4"
        >
          Retour aux dépenses
        </Link>
      </div>
    );
  }

  const [budgets, categories, organisation] = await Promise.all([
    prisma.budget.findMany({
      where: { organizationId: session.organizationId },
      orderBy: [{ categoryId: "asc" }],
      include: {
        category: { select: { name: true, codeSyscohada: true, color: true } },
      },
    }),
    prisma.category.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { codeSyscohada: "asc" },
      select: { id: true, name: true, codeSyscohada: true, color: true },
    }),
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { settings: true },
    }),
  ]);

  const seuilAlerte = lireSeuilAlerte(organisation?.settings);

  // Une somme par budget : chaque jauge couvre SA période (mois ou trimestre
  // en cours) et SA portée (une catégorie, ou tout le journal).
  const consommations = await Promise.all(
    budgets.map(async (budget) => {
      const periode = periodeBudget(budget.period);
      const somme = await prisma.expense.aggregate({
        where: {
          organizationId: session.organizationId,
          date: { gte: periode.debut, lte: periode.fin },
          ...(budget.categoryId ? { categoryId: budget.categoryId } : {}),
          ...dansLeJournal(),
        },
        _sum: { amount: true },
      });
      return somme._sum.amount ?? 0;
    }),
  );

  const maintenant = new Date();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="titre text-2xl md:text-3xl">Budgets</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {capitaliser(formatMois(maintenant))} — les jauges suivent le journal
        en temps réel.
      </p>

      {budgets.length > 0 && (
        <ul className="mt-8 divide-y divide-reglure overflow-hidden rounded-xl border border-reglure bg-card">
          {budgets.map((budget, index) => {
            const consomme = consommations[index];
            const pourcentage = Math.round((consomme / budget.amount) * 100);
            const seuilAlerte = Math.min(...budget.alertThresholds, 100);
            const etat =
              pourcentage >= 100
                ? "depasse"
                : pourcentage >= seuilAlerte
                  ? "alerte"
                  : "normal";
            const reste = budget.amount - consomme;

            return (
              <li key={budget.id} className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: budget.category?.color ?? "var(--cat-8)",
                    }}
                  />
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {budget.category?.name ?? "Global — toutes les dépenses"}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {LIBELLES_PERIODE[budget.period]}
                    </span>
                  </p>
                  <PastilleStatut
                    ton={
                      etat === "depasse"
                        ? "brique"
                        : etat === "alerte"
                          ? "ocre"
                          : "vert"
                    }
                  >
                    <span className="chiffre">{pourcentage} %</span>
                  </PastilleStatut>
                  <form action={supprimerBudget.bind(null, budget.id)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label="Supprimer ce budget"
                      className="text-muted-foreground hover:text-brique"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </form>
                </div>

                {/*
                  La jauge : bornée à 100 % visuellement, le texte dit le
                  vrai dépassement — une barre qui déborde ne mesure plus.

                  Le reste à dépenser est RÉGLÉ, pas grisé : c'est du budget
                  encore disponible, pas une absence. La métaphore tient jusque
                  dans le détail — la ligne du cahier attend qu'on écrive
                  dessus.
                */}
                <div
                  role="progressbar"
                  aria-valuenow={Math.min(pourcentage, 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${budget.category?.name ?? "Budget global"} : ${formatFCFA(consomme)} sur ${formatFCFA(budget.amount)}`}
                  className="regle-texture mt-3 h-3 w-full overflow-hidden rounded-full border border-reglure"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width]",
                      etat === "depasse" && "bg-brique",
                      etat === "alerte" && "bg-ocre",
                      etat === "normal" && "bg-indigo",
                    )}
                    style={{ width: `${Math.min(pourcentage, 100)}%` }}
                  />
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="chiffre">{formatFCFA(consomme)}</span>
                  {" sur "}
                  <span className="chiffre">{formatFCFA(budget.amount)}</span>
                  {" — "}
                  {reste >= 0 ? (
                    <>
                      reste <span className="chiffre">{formatFCFA(reste)}</span>
                    </>
                  ) : (
                    <span className="text-brique">
                      dépassé de{" "}
                      <span className="chiffre">{formatFCFA(-reste)}</span>
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {budgets.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-reglure bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun budget défini. Créez le premier ci-dessous : la jauge se
            remplira au fil des dépenses.
          </p>
        </div>
      )}

      <h2 className="titre mt-10 text-xl">Nouveau budget</h2>
      <FormulaireBudget categories={categories} seuilAlerte={seuilAlerte} />
    </div>
  );
}
