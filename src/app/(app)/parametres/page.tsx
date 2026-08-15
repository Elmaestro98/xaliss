import Link from "next/link";
import { FormulaireCategorie } from "@/components/formulaire-categorie";
import { FormulaireSeuilAlerte } from "@/components/formulaire-seuil-alerte";
import { LigneCategorie } from "@/components/ligne-categorie";
import { lireSeuilAlerte } from "@/lib/parametres";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const LIBELLE_DEVISE: Record<string, string> = {
  XOF: "Franc CFA (XOF)",
};

/**
 * Paramètres de l'entreprise (PROJET.md §4.5). La navigation réserve déjà la
 * page au gérant (`members:manage`), mais la page se protège elle-même —
 * l'interface ne fait jamais autorité (PROJET.md §5).
 *
 * Le nom et le logo sont synchronisés depuis Clerk (lib/sync-clerk.ts) : un
 * éditeur ici serait écrasé à la synchro suivante, donc l'identité est en
 * lecture seule et se modifie depuis le menu de l'entreprise.
 */
export default async function ParametresPage() {
  const session = await requireSession();

  if (!can(session.role, "members:manage")) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 md:px-8">
        <h1 className="titre text-2xl">Réservé au gérant</h1>
        <p className="mt-3 text-muted-foreground">
          Les paramètres de l&apos;entreprise sont gérés par le gérant.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm text-indigo underline underline-offset-4"
        >
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  const [organisation, categories] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { currency: true, settings: true },
    }),
    prisma.category.findMany({
      where: { organizationId: session.organizationId },
      orderBy: [{ codeSyscohada: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        codeSyscohada: true,
        color: true,
        isDefault: true,
        _count: { select: { expenses: true, budgets: true } },
      },
    }),
  ]);

  const devise = organisation?.currency ?? "XOF";
  const seuilAlerte = lireSeuilAlerte(organisation?.settings);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="titre text-2xl md:text-3xl">Paramètres</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        La configuration du registre
      </p>

      {/* Identité — lecture seule : elle vient de Clerk. */}
      <section className="mt-8">
        <h2 className="mention">
          Entreprise
        </h2>
        <div className="mt-2 flex items-center gap-4 rounded-xl border border-l-2 border-reglure border-l-indigo bg-card px-5 py-4">
          <span
            aria-hidden
            className="titre flex size-12 shrink-0 items-center justify-center bg-indigo text-xl text-white"
          >
            {session.organizationName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium">
              {session.organizationName}
            </p>
            <p className="text-sm text-muted-foreground">
              {LIBELLE_DEVISE[devise] ?? devise}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Le nom et le logo se modifient depuis le menu de l&apos;entreprise, en
          haut à gauche.
        </p>
      </section>

      {/* Seuils d'alerte — un réglage global, appliqué à tous les budgets. */}
      <section className="mt-10">
        <h2 className="titre text-xl">Seuils d&apos;alerte</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Quand prévenir avant qu&apos;un budget ne déborde.
        </p>
        <FormulaireSeuilAlerte seuilAlerte={seuilAlerte} />
      </section>

      {/* Catégories — le plan de comptes, entièrement modifiable. */}
      <section className="mt-10">
        <h2 className="titre text-xl">Catégories comptables</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Le plan de comptes de votre entreprise (codes SYSCOHADA). Chaque
          dépense se range dans l&apos;une d&apos;elles.
        </p>

        <ul className="mt-4 divide-y divide-reglure overflow-hidden rounded-xl border border-reglure bg-card">
          {categories.map((categorie) => (
            <LigneCategorie
              key={categorie.id}
              categorie={{
                id: categorie.id,
                name: categorie.name,
                codeSyscohada: categorie.codeSyscohada,
                color: categorie.color,
                isDefault: categorie.isDefault,
                nbUtilisations:
                  categorie._count.expenses + categorie._count.budgets,
              }}
            />
          ))}
        </ul>

        <FormulaireCategorie />

        <p className="mt-3 text-xs text-muted-foreground">
          Une catégorie utilisée par une dépense ou un budget ne peut pas être
          supprimée — renommez-la plutôt.
        </p>
      </section>
    </div>
  );
}
