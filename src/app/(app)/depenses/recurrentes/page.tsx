import Link from "next/link";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormulaireRecurrence } from "@/components/formulaire-recurrence";
import { formatDate, formatFCFA } from "@/lib/format";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { SchemaGabarit } from "@/lib/recurrentes";
import { requireSession } from "@/lib/session";
import { basculerRecurrence } from "./actions";

const LIBELLES_FREQUENCE = {
  MENSUELLE: "mensuelle",
  TRIMESTRIELLE: "trimestrielle",
} as const;

export default async function RecurrentesPage() {
  const session = await requireSession();

  // Même frontière que la saisie directe : l'employé passe par ses notes de
  // frais, les charges fixes de l'entreprise ne le concernent pas.
  if (!can(session.role, "expenses:write")) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 md:px-8">
        <h1 className="titre text-2xl">Réservé à la gestion</h1>
        <p className="mt-3 text-muted-foreground">
          Les dépenses récurrentes (loyer, abonnements) sont gérées par le
          gérant ou le comptable de l&apos;entreprise.
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

  const [recurrences, categories] = await Promise.all([
    prisma.recurringExpense.findMany({
      where: { organizationId: session.organizationId },
      orderBy: [{ active: "desc" }, { nextRunAt: "asc" }],
    }),
    prisma.category.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { codeSyscohada: "asc" },
      select: { id: true, name: true, codeSyscohada: true, color: true },
    }),
  ]);

  const nomsCategories = new Map(categories.map((c) => [c.id, c.name]));

  // Le Json de la base est revalidé avant affichage, comme au moment de la
  // génération : un gabarit corrompu s'affiche comme tel au lieu de planter.
  const lignes = recurrences.map((recurrence) => {
    const gabarit = SchemaGabarit.safeParse(recurrence.template);
    return { recurrence, gabarit: gabarit.success ? gabarit.data : null };
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <Link
        href="/depenses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Dépenses
      </Link>
      <h1 className="titre mt-3 text-2xl md:text-3xl">Dépenses récurrentes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Loyer, abonnements… saisis une fois, générés à chaque échéance.
      </p>

      {lignes.length > 0 && (
        <ul className="mt-8 divide-y divide-reglure overflow-hidden rounded-xl border border-reglure bg-card">
          {lignes.map(({ recurrence, gabarit }) => (
            <li
              key={recurrence.id}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                {gabarit ? (
                  <>
                    <p className="truncate font-medium">
                      {gabarit.supplier ??
                        gabarit.description ??
                        nomsCategories.get(gabarit.categoryId) ??
                        "Sans libellé"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {nomsCategories.get(gabarit.categoryId) ??
                        "Catégorie supprimée"}
                      {" · "}
                      {LIBELLES_FREQUENCE[recurrence.frequency]}
                      {" · "}
                      {recurrence.active
                        ? `prochaine le ${formatDate(recurrence.nextRunAt)}`
                        : "en pause"}
                    </p>
                  </>
                ) : (
                  <p className="text-brique">
                    Gabarit illisible — mettez cette récurrence en pause et
                    recréez-la.
                  </p>
                )}
              </div>

              {gabarit && (
                <span className="chiffre shrink-0 font-medium">
                  {formatFCFA(gabarit.amount)}
                </span>
              )}

              {!recurrence.active && (
                <Badge variant="outline" className="shrink-0">
                  En pause
                </Badge>
              )}

              {/*
                Une action serveur liée à l'identifiant : le bouton marche
                sans JavaScript et la vérification des droits reste côté
                serveur (actions.ts).
              */}
              <form action={basculerRecurrence.bind(null, recurrence.id)}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  aria-label={
                    recurrence.active
                      ? "Mettre en pause"
                      : "Réactiver"
                  }
                >
                  {recurrence.active ? (
                    <Pause className="size-4" aria-hidden />
                  ) : (
                    <Play className="size-4" aria-hidden />
                  )}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <h2 className="titre mt-10 text-xl">Nouvelle récurrence</h2>
      <FormulaireRecurrence categories={categories} />
    </div>
  );
}
