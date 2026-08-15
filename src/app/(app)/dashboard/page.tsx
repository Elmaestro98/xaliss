import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BandeRepartition } from "@/components/bande-repartition";
import { ChiffreAffichage } from "@/components/chiffre-affichage";
import { Feuille } from "@/components/feuille";
import { GrapheBarres } from "@/components/graphe-barres";
import { GrapheEvolution } from "@/components/graphe-evolution";
import { GrapheMoyens } from "@/components/graphe-moyens";
import { capitaliser, formatFCFA, formatMois, formatNombre } from "@/lib/format";
import { dansLeJournal } from "@/lib/journal";
import { MOYENS_PAIEMENT } from "@/lib/paiement";
import {
  derniersMois,
  evolution,
  periodeCourante,
  periodeEquivalenteMoisPrecedent,
} from "@/lib/periode";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await requireSession();
  const vueComplete = can(session.role, "dashboard:full");

  const maintenant = new Date();
  const courante = periodeCourante(maintenant);
  const precedente = periodeEquivalenteMoisPrecedent(maintenant);

  // Un employé n'a droit qu'à sa vue personnelle (PROJET.md §5). Le journal
  // n'inclut une dépense de note de frais qu'une fois celle-ci remboursée
  // (PROJET.md §4.3) : sans quoi soumettre une note gonflerait le total.
  const perimetre = {
    organizationId: session.organizationId,
    ...(vueComplete ? {} : { createdById: session.userId }),
    ...dansLeJournal(),
  };

  const [
    depensesEnTout,
    sommeCourante,
    sommePrecedente,
    parCategorie,
    notesEnAttente,
  ] = await Promise.all([
    prisma.expense.count({ where: perimetre }),
    prisma.expense.aggregate({
      where: { ...perimetre, date: { gte: courante.debut, lte: courante.fin } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: {
        ...perimetre,
        date: { gte: precedente.debut, lte: precedente.fin },
      },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      where: { ...perimetre, date: { gte: courante.debut, lte: courante.fin } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
    prisma.expenseReport.count({
      where: {
        organizationId: session.organizationId,
        status: "SOUMISE",
        ...(vueComplete ? {} : { employeeId: session.userId }),
      },
    }),
  ]);

  const total = sommeCourante._sum.amount ?? 0;
  const totalPrecedent = sommePrecedente._sum.amount ?? 0;
  const variation = evolution(total, totalPrecedent);

  const categories = await prisma.category.findMany({
    where: { id: { in: parCategorie.map((c) => c.categoryId) } },
    select: { id: true, name: true, codeSyscohada: true, color: true },
  });

  const segments = parCategorie.map((ligne) => {
    const categorie = categories.find((c) => c.id === ligne.categoryId);
    return {
      id: ligne.categoryId,
      nom: categorie?.name ?? "Sans catégorie",
      code: categorie?.codeSyscohada ?? null,
      couleur: categorie?.color ?? "var(--cat-8)",
      montant: ligne._sum.amount ?? 0,
    };
  });

  // Graphiques (PROJET.md §4.4). Même périmètre et mêmes règles de journal que
  // le total : évolution sur 6 mois, puis répartitions du mois courant.
  const mois6 = derniersMois(6, maintenant);
  const [totauxMensuels, parMoyen, parEmploye] = await Promise.all([
    Promise.all(
      mois6.map((m) =>
        prisma.expense.aggregate({
          where: { ...perimetre, date: { gte: m.debut, lt: m.finExclusive } },
          _sum: { amount: true },
        }),
      ),
    ),
    prisma.expense.groupBy({
      by: ["paymentMethod"],
      where: { ...perimetre, date: { gte: courante.debut, lte: courante.fin } },
      _sum: { amount: true },
    }),
    // « Par employé » n'a de sens qu'en vue entreprise ; en vue personnelle, il
    // n'y aurait qu'une seule personne (soi-même).
    vueComplete
      ? prisma.expense.groupBy({
          by: ["createdById"],
          where: {
            ...perimetre,
            date: { gte: courante.debut, lte: courante.fin },
          },
          _sum: { amount: true },
          orderBy: { _sum: { amount: "desc" } },
          take: 6,
        })
      : Promise.resolve([]),
  ]);

  const points = mois6.map((m, index) => ({
    label: capitaliser(m.label),
    montant: totauxMensuels[index]._sum.amount ?? 0,
  }));

  const moyens = parMoyen
    .map((ligne) => ({
      id: ligne.paymentMethod,
      label: MOYENS_PAIEMENT[ligne.paymentMethod].libelle,
      couleur: MOYENS_PAIEMENT[ligne.paymentMethod].couleur,
      montant: ligne._sum.amount ?? 0,
    }))
    .sort((a, b) => b.montant - a.montant);

  // Les noms des employés vivent chez Clerk (Membership ne porte qu'un
  // identifiant). Toutes les barres partagent l'encre indigo : ici la couleur
  // ne distingue pas les personnes, elle classe des montants.
  let employes: {
    id: string;
    label: string;
    couleur: string;
    montant: number;
  }[] = [];
  if (vueComplete && parEmploye.length > 0) {
    const client = await clerkClient();
    const { data: utilisateurs } = await client.users.getUserList({
      userId: parEmploye.map((ligne) => ligne.createdById),
      limit: 100,
    });
    const noms = new Map(
      utilisateurs.map((u) => [
        u.id,
        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
          u.username ||
          "—",
      ]),
    );
    employes = parEmploye.map((ligne) => ({
      id: ligne.createdById,
      label: noms.get(ligne.createdById) ?? "—",
      couleur: "var(--indigo)",
      montant: ligne._sum.amount ?? 0,
    }));
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {/* Dans un cahier, chaque mois est une page. */}
          <h1 className="titre text-2xl md:text-3xl">
            {capitaliser(formatMois(maintenant))}
          </h1>
          {!vueComplete && (
            <p className="mt-1 text-sm text-muted-foreground">
              Vos dépenses personnelles
            </p>
          )}
        </div>
        <Button asChild>
          <Link href="/depenses/nouvelle">
            <Plus className="size-4" aria-hidden />
            Saisir une dépense
          </Link>
        </Button>
      </header>

      {depensesEnTout === 0 ? (
        <PremierePage />
      ) : (
        <>
          <section className="mt-8" aria-labelledby="total-du-mois">
            <h2 id="total-du-mois" className="sr-only">
              Total dépensé ce mois
            </h2>

            {/* Le total est l'échelle de la bande, pas une carte isolée. */}
            <ChiffreAffichage
              montant={total}
              variation={variation}
              comparaison={`vs même période en ${
                formatMois(precedente.debut).split(" ")[0]
              }`}
            />

            <BandeRepartition segments={segments} total={total} />

            <p className="mt-3 text-sm text-muted-foreground">
              {sommeCourante._count === 0
                ? "Aucune dépense ce mois-ci."
                : `${sommeCourante._count} dépense${
                    sommeCourante._count > 1 ? "s" : ""
                  } · ${
                    totalPrecedent > 0
                      ? `${formatFCFA(totalPrecedent)} sur la même période le mois dernier`
                      : "rien à comparer le mois dernier"
                  }`}
            </p>
          </section>

          <section className="mt-10" aria-labelledby="analyse">
            <h2 id="analyse" className="mention">
              Le mois en détail
            </h2>

            <div className="mt-3 space-y-4">
              <Feuille
                titre="Évolution sur 6 mois"
                mention="Le mois courant est à l'encre, les précédents sont réglés"
              >
                <GrapheEvolution points={points} />
              </Feuille>

              <div className={`grid gap-4 ${vueComplete ? "md:grid-cols-2" : ""}`}>
                <Feuille
                  titre="Par moyen de paiement"
                  mention={capitaliser(formatMois(maintenant))}
                >
                  <GrapheMoyens moyens={moyens} />
                </Feuille>

                {vueComplete && (
                  <Feuille
                    titre="Par employé"
                    mention={capitaliser(formatMois(maintenant))}
                  >
                    <GrapheBarres items={employes} />
                  </Feuille>
                )}
              </div>
            </div>
          </section>

          <section className="mt-10" aria-labelledby="notes-en-attente">
            <h2 id="notes-en-attente" className="mention">
              Notes de frais
            </h2>

            {/*
              Une carte cliquable en entier plutôt qu'un lien à la fin : ce
              bloc ne sert qu'à emmener quelque part, et sur un téléphone une
              cible de la taille de la carte se touche du premier coup.
            */}
            <Link
              href="/notes-de-frais"
              className="mt-3 flex items-center gap-4 rounded-xl border border-reglure bg-card px-4 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:px-5"
            >
              <span className="titre chiffre text-3xl">{notesEnAttente}</span>
              <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                {notesEnAttente > 1 ? "notes en attente" : "note en attente"}
                {can(session.role, "reports:approve") && notesEnAttente > 0
                  ? " de votre validation"
                  : ""}
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </section>
        </>
      )}
    </div>
  );
}

/**
 * Un cahier neuf : la page vide invite à écrire, elle n'affiche pas un zéro.
 * Sans réglure ici — les lignes ne portent aucune rangée, elles couperaient le
 * texte. La réglure est réservée aux listes, où elle est structurelle.
 */
function PremierePage() {
  return (
    <div className="mt-8 rounded-xl border border-reglure bg-card px-6 py-14 text-center">
      <p className="titre text-xl">Le cahier est vide</p>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        Chaque dépense saisie ici alimente vos budgets, vos rapports et vos
        exports comptables. Commencez par la dernière que vous avez payée.
      </p>
      <Button asChild className="mt-6">
        <Link href="/depenses/nouvelle">
          <Plus className="size-4" aria-hidden />
          Saisir la première dépense
        </Link>
      </Button>
    </div>
  );
}
