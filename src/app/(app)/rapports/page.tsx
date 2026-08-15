import { redirect } from "next/navigation";
import { Download, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelecteurPeriode } from "@/components/selecteur-periode";
import { capitaliser, formatFCFA, formatMois } from "@/lib/format";
import { dansLeJournal } from "@/lib/journal";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resoudrePeriodeMois } from "@/lib/rapports";
import { requireSession } from "@/lib/session";

type Feuillet = {
  href: string;
  format: string;
  icone: LucideIcon;
  titre: string;
  apercu: string;
  description: string;
  vide: boolean;
};

/**
 * Rapports & exports comptables (PROJET.md §4.4). Réservée à ADMIN/COMPTABLE
 * (`exports:generate`) : la navigation masque déjà le lien pour un employé,
 * mais la page se protège elle-même — l'interface ne fait jamais autorité.
 *
 * Métaphore du cahier : chaque export est un feuillet qu'on détache du
 * registre pour un mois donné. L'en-tête reprend la marge indigo de la
 * navigation, et l'aperçu chiffré évite de télécharger un feuillet vide.
 */
export default async function RapportsPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>;
}) {
  const session = await requireSession();
  if (!can(session.role, "exports:generate")) redirect("/dashboard");

  const { mois } = await searchParams;
  const periode = resoudrePeriodeMois(mois);

  const perimetre = { organizationId: session.organizationId, ...dansLeJournal() };

  const [journal, nombreNotes] = await Promise.all([
    prisma.expense.aggregate({
      where: { ...perimetre, date: { gte: periode.debut, lt: periode.fin } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expenseReport.count({
      where: {
        organizationId: session.organizationId,
        createdAt: { gte: periode.debut, lt: periode.fin },
      },
    }),
  ]);

  const nombreDepenses = journal._count;
  const totalDepenses = journal._sum.amount ?? 0;

  const feuillets: Feuillet[] = [
    {
      href: "/api/rapports/journal",
      format: ".xlsx",
      icone: FileSpreadsheet,
      titre: "Journal des dépenses",
      apercu:
        nombreDepenses > 0
          ? `${nombreDepenses} dépense${nombreDepenses > 1 ? "s" : ""} · ${formatFCFA(totalDepenses)}`
          : "Aucune dépense ce mois-ci",
      description: "Le détail ligne à ligne, codes SYSCOHADA compris.",
      vide: nombreDepenses === 0,
    },
    {
      href: "/api/rapports/synthese",
      format: ".pdf",
      icone: FileText,
      titre: "Synthèse mensuelle",
      apercu:
        nombreDepenses > 0
          ? `${formatFCFA(totalDepenses)} au total`
          : "Aucune dépense ce mois-ci",
      description:
        "Total, évolution et répartitions par catégorie et moyen de paiement.",
      vide: nombreDepenses === 0,
    },
    {
      href: "/api/rapports/notes",
      format: ".pdf",
      icone: FileText,
      titre: "État des notes de frais",
      apercu:
        nombreNotes > 0
          ? `${nombreNotes} note${nombreNotes > 1 ? "s" : ""} sur le mois`
          : "Aucune note ce mois-ci",
      description: "Par employé : statuts et montants remboursés.",
      vide: nombreNotes === 0,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="titre text-2xl md:text-3xl">Rapports</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Extraits du registre comptable
      </p>

      {/*
        Un seul formulaire GET : le sélecteur de mois resoumet vers la page
        (aperçus rafraîchis), chaque bouton porte son propre formAction vers
        sa route d'export. Le navigateur télécharge sans quitter la page
        (Content-Disposition: attachment).
      */}
      <form className="mt-8">
        {/* En-tête de feuillet — reprend la marge indigo de la navigation. */}
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-l-2 border-reglure border-l-indigo bg-card px-5 py-4">
          <div>
            <p className="mention">
              Période d&apos;extraction
            </p>
            <p className="titre mt-1 text-2xl">
              {capitaliser(formatMois(periode.debut))}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Registre de {session.organizationName}
            </p>
          </div>
          <SelecteurPeriode defaultValue={periode.param} />
        </div>

        {/* Les feuillets à détacher. */}
        <ul className="mt-4 divide-y divide-reglure overflow-hidden rounded-xl border border-reglure bg-card">
          {feuillets.map((feuillet) => {
            const Icone = feuillet.icone;
            return (
              <li
                key={feuillet.href}
                className="flex flex-wrap items-center gap-4 px-4 py-4"
              >
                {/* Timbre de format : la référence de classement, en mono. */}
                <div className="flex w-14 shrink-0 flex-col items-center gap-1.5 border border-reglure py-2.5 text-indigo">
                  <Icone className="size-5" aria-hidden />
                  <span className="code-compte text-muted-foreground">
                    {feuillet.format}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{feuillet.titre}</p>
                  <p
                    className={`chiffre mt-0.5 text-sm ${
                      feuillet.vide ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {feuillet.apercu}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {feuillet.description}
                  </p>
                </div>

                <Button
                  type="submit"
                  formAction={feuillet.href}
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  <Download aria-hidden />
                  Télécharger
                </Button>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-xs text-muted-foreground">
          Les dépenses des notes de frais n&apos;entrent au journal qu&apos;une
          fois la note remboursée.
        </p>
      </form>
    </div>
  );
}
