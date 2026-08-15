import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import {
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Plus,
  Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExpenseStatus } from "@/generated/prisma/enums";
import { capitaliser, formatFCFA, formatMois } from "@/lib/format";
import { dansLeJournal } from "@/lib/journal";
import { MOYENS_PAIEMENT } from "@/lib/paiement";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

const PAR_PAGE = 50;

const LIBELLES_STATUT: Record<ExpenseStatus, string> = {
  EN_ATTENTE: "En attente",
  VALIDEE: "Validée",
};

/**
 * Valeur sentinelle des selects « pas de filtre » : Radix interdit la chaîne
 * vide comme valeur d'option, on filtre donc « tous » au parsing.
 */
const TOUS = "tous";

type ParametresBruts = { [key: string]: string | string[] | undefined };

/** Un paramètre répété (?q=a&q=b) arrive en tableau : on garde le premier. */
function premier(valeur: string | string[] | undefined): string | undefined {
  const brut = Array.isArray(valeur) ? valeur[0] : valeur;
  const nettoye = brut?.trim();
  return nettoye && nettoye !== TOUS ? nettoye : undefined;
}

function versDate(valeur: string | undefined): Date | undefined {
  if (!valeur) return undefined;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Les filtres vivent dans l'URL, pas dans un état côté client : un filtre se
 * partage par copier-coller du lien, le bouton Retour le restaure, et le
 * serveur fait le tri en une seule requête. Toute valeur invalide est
 * simplement ignorée — une URL bricolée à la main ne casse rien.
 */
function lireFiltres(params: ParametresBruts) {
  const statutBrut = premier(params.statut);
  const pageBrute = Number(premier(params.page));

  // Les chaînes d'origine (aaaa-mm-jj) restent nécessaires telles quelles :
  // pour pré-remplir les champs date et reconstruire les liens de pagination.
  const duBrut = premier(params.du);
  const auBrut = premier(params.au);
  const du = versDate(duBrut);
  const auJour = versDate(auBrut);
  // Le champ date donne un minuit : pour inclure tout le jour « au », la
  // borne devient « strictement avant le lendemain ».
  let au: Date | undefined;
  if (auJour) {
    au = new Date(auJour);
    au.setDate(au.getDate() + 1);
  }

  return {
    q: premier(params.q),
    categorieId: premier(params.categorie),
    employeId: premier(params.employe),
    statut: Object.values(ExpenseStatus).find((s) => s === statutBrut),
    du,
    au,
    duBrut: du ? duBrut : undefined,
    auBrut: auJour ? auBrut : undefined,
    page: Number.isInteger(pageBrute) && pageBrute >= 1 ? pageBrute : 1,
  };
}

export default async function DepensesPage({
  searchParams,
}: {
  searchParams: Promise<ParametresBruts>;
}) {
  const session = await requireSession();
  const vueComplete = can(session.role, "expenses:read:all");
  const peutSaisir = can(session.role, "expenses:write");

  const filtres = lireFiltres(await searchParams);
  const filtresActifs = Boolean(
    filtres.q ||
      filtres.categorieId ||
      filtres.employeId ||
      filtres.statut ||
      filtres.du ||
      filtres.au,
  );

  const where = {
    organizationId: session.organizationId,
    // Le rôle borne d'abord, le filtre « employé » raffine ensuite : un
    // EMPLOYE ne voit que lui, quoi que dise l'URL.
    ...(vueComplete
      ? filtres.employeId
        ? { createdById: filtres.employeId }
        : {}
      : { createdById: session.userId }),
    ...(filtres.categorieId ? { categoryId: filtres.categorieId } : {}),
    ...(filtres.statut ? { status: filtres.statut } : {}),
    ...(filtres.du || filtres.au
      ? {
          date: {
            ...(filtres.du ? { gte: filtres.du } : {}),
            ...(filtres.au ? { lt: filtres.au } : {}),
          },
        }
      : {}),
    // dansLeJournal() porte son propre OR : combiné avec celui de la
    // recherche texte, il doit passer par AND pour ne pas écraser l'un des
    // deux (une même clé "where" ne garde que le dernier OR assigné).
    AND: [
      dansLeJournal(),
      ...(filtres.q
        ? [
            {
              OR: [
                {
                  supplier: {
                    contains: filtres.q,
                    mode: "insensitive" as const,
                  },
                },
                {
                  description: {
                    contains: filtres.q,
                    mode: "insensitive" as const,
                  },
                },
              ],
            },
          ]
        : []),
    ],
  };

  const [nombreTotal, sommeFiltree, depenses, categories] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
    prisma.expense.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (filtres.page - 1) * PAR_PAGE,
      take: PAR_PAGE,
      select: {
        id: true,
        amount: true,
        date: true,
        supplier: true,
        paymentMethod: true,
        // Une dépense issue d'une note de frais ne se corrige pas depuis le
        // journal : la ligne reste alors du texte, sans lien.
        reportId: true,
        category: { select: { name: true, codeSyscohada: true, color: true } },
        // Un seul suffit : le trombone dit « il y a une pièce », pas combien.
        receipts: { select: { id: true }, take: 1 },
      },
    }),
    prisma.category.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { codeSyscohada: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Les noms des collègues vivent chez Clerk, pas en base : Membership ne
  // porte que l'identifiant (PROJET.md §7).
  let employes: { id: string; nom: string }[] = [];
  if (vueComplete) {
    const client = await clerkClient();
    const adhesions = await client.organizations.getOrganizationMembershipList({
      organizationId: session.organizationId,
      limit: 100,
    });
    employes = adhesions.data.flatMap((adhesion) => {
      const profil = adhesion.publicUserData;
      if (!profil?.userId) return [];
      const nom =
        [profil.firstName, profil.lastName].filter(Boolean).join(" ") ||
        profil.identifier;
      return [{ id: profil.userId, nom }];
    });
  }

  const totalPages = Math.max(1, Math.ceil(nombreTotal / PAR_PAGE));

  /** Reconstruit l'URL courante en ne changeant que la page. */
  function lienPage(page: number) {
    const params = new URLSearchParams();
    if (filtres.q) params.set("q", filtres.q);
    if (filtres.categorieId) params.set("categorie", filtres.categorieId);
    if (filtres.employeId) params.set("employe", filtres.employeId);
    if (filtres.statut) params.set("statut", filtres.statut);
    if (filtres.duBrut) params.set("du", filtres.duBrut);
    if (filtres.auBrut) params.set("au", filtres.auBrut);
    params.set("page", String(page));
    return `/depenses?${params.toString()}`;
  }

  // Le cahier se tient par mois : une page, un total.
  const mois = new Map<string, typeof depenses>();
  for (const depense of depenses) {
    const cle = `${depense.date.getFullYear()}-${depense.date.getMonth()}`;
    mois.set(cle, [...(mois.get(cle) ?? []), depense]);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titre text-2xl md:text-3xl">Dépenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {vueComplete
              ? "Le journal de l'entreprise"
              : "Les dépenses que vous avez saisies"}
          </p>
        </div>
        {peutSaisir && (
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link href="/depenses/recurrentes">
                <Repeat className="size-4" aria-hidden />
                Récurrentes
              </Link>
            </Button>
            <Button asChild>
              <Link href="/depenses/nouvelle">
                <Plus className="size-4" aria-hidden />
                Saisir une dépense
              </Link>
            </Button>
          </div>
        )}
      </header>

      {/*
        Formulaire GET sans JavaScript : soumettre écrit les filtres dans
        l'URL, et l'absence de champ « page » ramène naturellement à la
        première page à chaque changement de filtre.
      */}
      <form
        method="get"
        className="mt-6 grid gap-3 rounded-xl border border-reglure bg-card p-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div className="sm:col-span-2 lg:col-span-3">
          <Label htmlFor="q">Recherche</Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filtres.q ?? ""}
            placeholder="Fournisseur ou description…"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="filtre-categorie">Catégorie</Label>
          <Select name="categorie" defaultValue={filtres.categorieId ?? TOUS}>
            <SelectTrigger id="filtre-categorie" className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Toutes les catégories</SelectItem>
              {categories.map((categorie) => (
                <SelectItem key={categorie.id} value={categorie.id}>
                  {categorie.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {vueComplete && (
          <div>
            <Label htmlFor="filtre-employe">Employé</Label>
            <Select name="employe" defaultValue={filtres.employeId ?? TOUS}>
              <SelectTrigger id="filtre-employe" className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOUS}>Toute l&apos;équipe</SelectItem>
                {employes.map((employe) => (
                  <SelectItem key={employe.id} value={employe.id}>
                    {employe.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label htmlFor="filtre-statut">Statut</Label>
          <Select name="statut" defaultValue={filtres.statut ?? TOUS}>
            <SelectTrigger id="filtre-statut" className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Tous les statuts</SelectItem>
              {Object.values(ExpenseStatus).map((statut) => (
                <SelectItem key={statut} value={statut}>
                  {LIBELLES_STATUT[statut]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-2">
          <div>
            <Label htmlFor="filtre-du">Du</Label>
            <Input
              id="filtre-du"
              name="du"
              type="date"
              defaultValue={filtres.duBrut ?? ""}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="filtre-au">Au</Label>
            <Input
              id="filtre-au"
              name="au"
              type="date"
              defaultValue={filtres.auBrut ?? ""}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="flex items-end gap-3">
          <Button type="submit" variant="secondary">
            Filtrer
          </Button>
          {filtresActifs && (
            <Button variant="ghost" asChild>
              <Link href="/depenses">Réinitialiser</Link>
            </Button>
          )}
        </div>
      </form>

      {filtresActifs && (
        <p className="mt-4 text-sm text-muted-foreground">
          {nombreTotal === 0
            ? "Aucune dépense ne correspond à ces critères."
            : `${nombreTotal} dépense${nombreTotal > 1 ? "s" : ""} — total ${formatFCFA(sommeFiltree._sum.amount ?? 0)}`}
        </p>
      )}

      {depenses.length === 0 && !filtresActifs ? (
        <div className="mt-8 rounded-xl border border-reglure bg-card px-6 py-14 text-center">
          <p className="titre text-xl">Aucune dépense</p>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            {peutSaisir
              ? "Saisissez la dernière dépense que vous avez payée : le journal se construit ligne par ligne."
              : "Vos dépenses apparaîtront ici une fois vos notes de frais remboursées."}
          </p>
          {peutSaisir && (
            <Button asChild className="mt-6">
              <Link href="/depenses/nouvelle">
                <Plus className="size-4" aria-hidden />
                Saisir une dépense
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {[...mois.entries()].map(([cle, lignes]) => {
            const total = lignes.reduce((s, l) => s + l.amount, 0);
            return (
              <section key={cle} aria-labelledby={`mois-${cle}`}>
                <div className="flex items-baseline justify-between gap-4 pb-2">
                  <h2
                    id={`mois-${cle}`}
                    className="mention"
                  >
                    {capitaliser(formatMois(lignes[0].date))}
                  </h2>
                  <p className="chiffre text-sm font-medium">
                    {formatFCFA(total)}
                  </p>
                </div>

                <ul className="papier-regle overflow-hidden rounded-xl border border-reglure bg-card">
                  {lignes.map((depense) => {
                    const moyen = MOYENS_PAIEMENT[depense.paymentMethod];
                    // Le libellé porte le lien de correction, plutôt qu'un
                    // bouton par ligne : le journal reste une colonne de
                    // lignes de 11 unités, sans commandes qui l'encombrent.
                    const corrigible = peutSaisir && !depense.reportId;
                    const libelle = (
                      <>
                        {depense.supplier ?? depense.category.name}
                        {depense.supplier && (
                          <span className="ml-2 text-muted-foreground">
                            {depense.category.name}
                          </span>
                        )}
                      </>
                    );
                    return (
                      <li
                        key={depense.id}
                        className="flex h-11 items-center gap-3 px-3 text-sm"
                      >
                        <span className="code-compte w-8 shrink-0 text-muted-foreground">
                          {String(depense.date.getDate()).padStart(2, "0")}
                        </span>
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor: depense.category.color ?? "var(--cat-8)",
                          }}
                        />
                        {corrigible ? (
                          <Link
                            href={`/depenses/${depense.id}/modifier`}
                            className="min-w-0 flex-1 truncate underline-offset-4 hover:underline"
                          >
                            {libelle}
                          </Link>
                        ) : (
                          <span className="min-w-0 flex-1 truncate">
                            {libelle}
                          </span>
                        )}
                        <span className="code-compte hidden w-10 shrink-0 text-muted-foreground sm:block">
                          {depense.category.codeSyscohada}
                        </span>
                        {/*
                          Moyen de paiement en texte, sans pastille : dans une
                          ligne, la couleur signifie la catégorie et rien
                          d'autre. Les couleurs Wave / Orange Money ne servent
                          que là où le moyen de paiement est le sujet.
                        */}
                        <span className="hidden w-24 shrink-0 text-xs text-muted-foreground sm:block">
                          {moyen.libelle}
                        </span>
                        {/*
                          target="_blank" : le justificatif s'ouvre à côté du
                          journal, pas à sa place. La route vérifie les droits
                          puis redirige vers une URL signée éphémère.
                        */}
                        {depense.receipts.length > 0 ? (
                          <a
                            href={`/depenses/${depense.id}/justificatif`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Voir le justificatif"
                            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Paperclip className="size-3.5" aria-hidden />
                          </a>
                        ) : (
                          <span aria-hidden className="w-3.5 shrink-0" />
                        )}
                        <span className="chiffre shrink-0 font-medium">
                          {formatFCFA(depense.amount)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between border-t border-reglure pt-4"
            >
              {filtres.page > 1 ? (
                <Button variant="ghost" asChild>
                  <Link href={lienPage(filtres.page - 1)}>
                    <ChevronLeft className="size-4" aria-hidden />
                    Précédente
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <p className="code-compte text-muted-foreground">
                Page {filtres.page} / {totalPages}
              </p>
              {filtres.page < totalPages ? (
                <Button variant="ghost" asChild>
                  <Link href={lienPage(filtres.page + 1)}>
                    Suivante
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      )}
    </div>
  );
}
