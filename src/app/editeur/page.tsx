import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { clerkClient } from "@clerk/nextjs/server";
import {
  BillingCycle,
  PaymentStatus,
  type Role,
  type SubscriptionPlan,
  SubscriptionStatus,
} from "@/generated/prisma/enums";
import { ROLES } from "@/lib/paiement";
import { periodeCourante } from "@/lib/periode";
import { BasculeTheme } from "@/components/bascule-theme";
import { Feuille } from "@/components/feuille";
import { FormulaireEncaissement } from "@/components/formulaire-encaissement";
import { PastilleStatut, type Ton } from "@/components/pastille-statut";
import { requireEditeur } from "@/lib/editeur";
import { paiementsAVerifier } from "@/lib/facturation";
import { formatDate, formatFCFA, formatNombre } from "@/lib/format";
import {
  estIllimite,
  formatQuota,
  PLANS,
  prixPour,
  type Quota,
} from "@/lib/plans";
import { prismaHorsPortee } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { JOURS_DE_GRACE } from "@/lib/purge";

export const metadata = { title: "Console éditeur — Xaalis" };

/**
 * Jamais mise en cache, jamais préconstruite.
 *
 * Une console qui affiche les paiements en attente de tous les clients doit
 * lire la base à chaque ouverture — un instantané figé au build ferait rater
 * une déclaration. `requireEditeur()` appelle déjà `auth()`, ce qui suffirait
 * en pratique ; on l'écrit quand même, parce que la conséquence d'un oubli
 * (une page d'administration servie depuis un cache) ne doit pas dépendre
 * d'un détail d'implémentation situé dans un autre fichier.
 */
export const dynamic = "force-dynamic";

/** Les trois vues de la console. Tout le reste de `?vue=` retombe ici. */
const VUES = ["finances", "entreprises", "utilisateurs"] as const;
type Vue = (typeof VUES)[number];

/** Les colonnes triables du tableau des entreprises. */
const TRIS = ["nom", "echeance", "membres"] as const;
type Tri = (typeof TRIS)[number];

/**
 * La console de l'éditeur — AFRICATECHNOLOGIE, pas un client.
 *
 * ⚠️ ELLE ENCAISSE. Le §7 posait au départ que l'activation d'un abonnement ne
 * devait être atteignable par AUCUNE requête web : c'était l'inaccessibilité
 * qui remplaçait la signature du webhook Wave supprimé. Cette page lève cette
 * barrière, sciemment (décision du 15 août 2026, PROJET.md §7).
 *
 * Ce qui la remplace, et qu'il faut tenir :
 *  - `requireEditeur()` en tête de CHAQUE action serveur — une action est une
 *    route publique tant qu'elle ne s'est pas gardée elle-même ;
 *  - le montant constaté est retapé à la main et confronté à l'attendu ;
 *  - `encaisserPaiement()` reste l'unique implémentation de l'activation, que
 *    l'appel vienne du script ou d'ici ;
 *  - l'AuditLog enregistre désormais QUEL éditeur a validé — ce que la ligne
 *    de commande ne savait pas faire. On a perdu une barrière, on a gagné une
 *    trace.
 *
 * Le risque assumé : si le compte Clerk de l'éditeur est compromis, un
 * attaquant s'active le plan de son choix. Avec le script seul, il lui aurait
 * fallu un accès au serveur.
 *
 * Elle vit hors du groupe (app) : ce layout appelle `requireSession()`, qui
 * exige une entreprise active. L'éditeur n'en a pas — il les regarde toutes.
 */
export default async function ConsoleEditeur({
  searchParams,
}: {
  searchParams: Promise<{
    vue?: string;
    tri?: string;
    sens?: string;
  }>;
}) {
  const monIdentifiant = await requireEditeur();

  /*
   * Onglets et tri vivent dans l'URL, pas dans l'état React.
   *
   * Deux raisons, et la seconde est décisive : une vue se met en favori et se
   * partage ; surtout, un tri stocké dans un état React serait perdu à chaque
   * navigation — trier une colonne ferait retomber sur l'onglet par défaut.
   * Les deux doivent vivre au même endroit, sinon ils se marchent dessus.
   */
  const params = await searchParams;
  const vue: Vue = VUES.includes(params.vue as Vue)
    ? (params.vue as Vue)
    : "finances";
  const tri: Tri = TRIS.includes(params.tri as Tri)
    ? (params.tri as Tri)
    : "nom";
  const descendant = params.sens === "desc";

  // Hors portée, par définition : c'est la seule page de Xaalis dont le sujet
  // est l'ensemble des entreprises. Chaque requête ci-dessous serait un défaut
  // grave n'importe où ailleurs.
  const maintenant = new Date();
  const { debut: debutDuMois } = periodeCourante(maintenant);

  const [
    entreprises,
    aVerifier,
    adhesions,
    encaisseCeMois,
    depensesParOrg,
    ocrParOrg,
    derniersPaiements,
  ] = await Promise.all([
    prismaHorsPortee.organization.findMany({
      include: {
        subscription: true,
        _count: { select: { memberships: true, expenses: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    paiementsAVerifier(),
    prismaHorsPortee.membership.findMany({
      include: { organization: { select: { name: true, deletedAt: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prismaHorsPortee.payment.aggregate({
      where: { status: PaymentStatus.SUCCEEDED, paidAt: { gte: debutDuMois } },
      _sum: { amount: true },
      _count: true,
    }),
    // Deux groupBy plutôt qu'un relevé par entreprise : à 50 clients, la
    // seconde version ferait cent requêtes pour afficher un tableau.
    prismaHorsPortee.expense.groupBy({
      by: ["organizationId"],
      where: { createdAt: { gte: debutDuMois } },
      _count: true,
    }),
    prismaHorsPortee.ocrUsage.groupBy({
      by: ["organizationId"],
      where: { createdAt: { gte: debutDuMois } },
      _count: true,
    }),
    prismaHorsPortee.payment.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { organization: { select: { name: true } } },
    }),
  ]);

  const consommation = new Map<string, { depenses: number; ocr: number }>();
  for (const ligne of depensesParOrg) {
    consommation.set(ligne.organizationId, {
      depenses: ligne._count,
      ocr: 0,
    });
  }
  for (const ligne of ocrParOrg) {
    const actuel = consommation.get(ligne.organizationId) ?? {
      depenses: 0,
      ocr: 0,
    };
    actuel.ocr = ligne._count;
    consommation.set(ligne.organizationId, actuel);
  }

  // Les personnes vivent chez Clerk, leurs rôles chez nous (PROJET.md §6).
  // Il faut donc joindre les deux : ni l'un ni l'autre ne suffit seul.
  const clerk = await clerkClient();
  const { data: comptes } = await clerk.users.getUserList({ limit: 200 });

  const parUtilisateur = new Map<string, typeof adhesions>();
  for (const adhesion of adhesions) {
    const liste = parUtilisateur.get(adhesion.userId) ?? [];
    liste.push(adhesion);
    parUtilisateur.set(adhesion.userId, liste);
  }

  const utilisateurs = comptes.map((compte) => ({
    id: compte.id,
    nom:
      [compte.firstName, compte.lastName].filter(Boolean).join(" ") ||
      compte.username ||
      "—",
    email: compte.emailAddresses[0]?.emailAddress ?? "—",
    inscritLe: new Date(compte.createdAt),
    adhesions: parUtilisateur.get(compte.id) ?? [],
  }));

  const actives = entreprises.filter((e) => !e.deletedAt);
  const supprimees = entreprises.filter((e) => e.deletedAt);

  /*
   * Tri en mémoire, pas en base.
   *
   * `entreprises` est déjà chargé en entier — il le faut pour le revenu
   * récurrent, qui additionne toutes les lignes. Redemander la même liste
   * triée à PostgreSQL serait une seconde requête pour un tableau de trois
   * lignes. À revoir si la liste dépasse quelques centaines d'entreprises :
   * il faudra alors paginer, et donc trier côté base.
   */
  const triees = [...actives].sort((a, b) => {
    let ecart: number;
    switch (tri) {
      case "echeance": {
        // Sans abonnement, pas d'échéance : ces lignes vont au bout, quel que
        // soit le sens. Les intercaler ferait croire à une date manquante.
        const gauche = a.subscription?.currentPeriodEnd.getTime();
        const droite = b.subscription?.currentPeriodEnd.getTime();
        if (gauche === undefined) return 1;
        if (droite === undefined) return -1;
        ecart = gauche - droite;
        break;
      }
      case "membres":
        ecart = a._count.memberships - b._count.memberships;
        break;
      default:
        ecart = a.name.localeCompare(b.name, "fr");
    }
    return descendant ? -ecart : ecart;
  });

  /*
   * Le revenu récurrent mensuel.
   *
   * Seuls les abonnements ACTIFS comptent : un essai n'est pas un revenu, et
   * le compter reviendrait à se féliciter d'une facture qui n'existe pas. Un
   * plan annuel est ramené au mois — au tarif réellement payé, donc dix mois
   * facturés divisés par douze, et non le tarif mensuel affiché.
   */
  const mrr = actives.reduce((somme, entreprise) => {
    const abonnement = entreprise.subscription;
    if (!abonnement || abonnement.status !== SubscriptionStatus.ACTIVE) {
      return somme;
    }
    const mensuel =
      abonnement.billingCycle === BillingCycle.YEARLY
        ? Math.round(prixPour(abonnement.plan, BillingCycle.YEARLY) / 12)
        : PLANS[abonnement.plan].prixMensuel;
    return somme + mensuel;
  }, 0);

  const essais = actives.filter(
    (e) => e.subscription?.status === SubscriptionStatus.TRIALING,
  ).length;

  const enRetard = actives.filter(
    (e) =>
      e.subscription?.status === SubscriptionStatus.PAST_DUE ||
      e.subscription?.status === SubscriptionStatus.SUSPENDED,
  ).length;

  // Les quinze prochains jours : ce qu'il faut relancer cette semaine. Les
  // échéances déjà passées ne sont pas ici — elles sont dans « en retard ».
  const limiteRelance = new Date(maintenant);
  limiteRelance.setDate(limiteRelance.getDate() + 15);

  const aRelancer = actives
    .filter((entreprise) => {
      const abonnement = entreprise.subscription;
      if (!abonnement) return false;
      if (
        abonnement.status !== SubscriptionStatus.TRIALING &&
        abonnement.status !== SubscriptionStatus.ACTIVE
      ) {
        return false;
      }
      return (
        abonnement.currentPeriodEnd > maintenant &&
        abonnement.currentPeriodEnd <= limiteRelance
      );
    })
    .sort(
      (a, b) =>
        a.subscription!.currentPeriodEnd.getTime() -
        b.subscription!.currentPeriodEnd.getTime(),
    );

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-reglure bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="titre text-xl">
              Xaalis
            </Link>
            <span className="mention">Console éditeur</span>
          </div>
          <div className="flex items-center gap-2">
            <BasculeTheme />
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <h1 className="titre text-2xl md:text-3xl">
          {actives.length} entreprise{actives.length > 1 ? "s" : ""},{" "}
          {utilisateurs.length} utilisateur
          {utilisateurs.length > 1 ? "s" : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seuls les paiements déclarés se valident ici. Le reste est en lecture
          seule.
        </p>

        <Onglets vue={vue} enAttente={aVerifier.length} />

        {vue === "finances" && (
          <>
            {/*
              Les quatre chiffres qui répondent à « comment va l'affaire ? ».
              Placés avant tout le reste : c'est la question qu'on se pose en
              ouvrant la console, avant même de savoir ce qui attend.
            */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tuile
            mention="Encaissé ce mois"
            valeur={formatNombre(encaisseCeMois._sum.amount ?? 0)}
            unite="FCFA"
            precision={`${encaisseCeMois._count} paiement${
              encaisseCeMois._count > 1 ? "s" : ""
            } validé${encaisseCeMois._count > 1 ? "s" : ""}`}
          />
          <Tuile
            mention="Revenu mensuel récurrent"
            valeur={formatNombre(mrr)}
            unite="FCFA"
            precision="abonnements actifs, annuels ramenés au mois"
          />
          <Tuile
            mention="Essais en cours"
            valeur={String(essais)}
            precision={`sur ${actives.length} entreprise${
              actives.length > 1 ? "s" : ""
            }`}
          />
          <Tuile
            mention="En retard"
            valeur={String(enRetard)}
            precision="impayés ou suspendus"
            alerte={enRetard > 0}
          />
        </div>

            <FileDAttente paiements={aVerifier} />

            {aRelancer.length > 0 && (
              <ARelancer entreprises={aRelancer} maintenant={maintenant} />
            )}

            <JournalPaiements paiements={derniersPaiements} />
          </>
        )}

        {vue === "entreprises" && (
          <section className="mt-6">
            <h2 className="sr-only">Entreprises</h2>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-separate border-spacing-0 overflow-hidden rounded-xl border border-reglure bg-card text-sm">
              <thead>
                <tr className="border-b border-reglure">
                  <ThTri colonne="nom" tri={tri} descendant={descendant}>
                    Entreprise
                  </ThTri>
                  <Th>Abonnement</Th>
                  <ThTri colonne="echeance" tri={tri} descendant={descendant}>
                    Échéance
                  </ThTri>
                  <ThTri
                    colonne="membres"
                    tri={tri}
                    descendant={descendant}
                    aligne="droite"
                  >
                    Membres
                  </ThTri>
                  <Th>Consommation du mois</Th>
                </tr>
              </thead>
              <tbody>
                {triees.map((entreprise) => (
                  <tr key={entreprise.id} className="border-t border-reglure">
                    <Td>
                      <span className="font-medium">{entreprise.name}</span>
                      <span className="code-compte mt-0.5 block text-muted-foreground">
                        {entreprise.id}
                      </span>
                    </Td>
                    <Td>
                      {entreprise.subscription ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <PastilleStatut
                            ton={ETATS[entreprise.subscription.status].ton}
                          >
                            {ETATS[entreprise.subscription.status].libelle}
                          </PastilleStatut>
                          <span className="text-muted-foreground">
                            {PLANS[entreprise.subscription.plan].nom}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td>
                      {entreprise.subscription ? (
                        <Echeance
                          date={entreprise.subscription.currentPeriodEnd}
                          maintenant={maintenant}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td aligne="droite">
                      <span className="chiffre">
                        {entreprise._count.memberships}
                        {entreprise.subscription && (
                          <span className="text-muted-foreground">
                            {" / "}
                            {formatQuota(
                              PLANS[entreprise.subscription.plan].utilisateurs,
                            )}
                          </span>
                        )}
                      </span>
                    </Td>
                    <Td>
                      <Consommation
                        plan={entreprise.subscription?.plan ?? null}
                        releve={
                          consommation.get(entreprise.id) ?? {
                            depenses: 0,
                            ocr: 0,
                          }
                        }
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            {supprimees.length > 0 && (
              <EnAttenteDePurge entreprises={supprimees} />
            )}
          </section>
        )}

        {vue === "utilisateurs" && (
          <Utilisateurs
            utilisateurs={utilisateurs}
            monIdentifiant={monIdentifiant}
          />
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const ETATS: Record<SubscriptionStatus, { libelle: string; ton: Ton }> = {
  [SubscriptionStatus.TRIALING]: { libelle: "Essai", ton: "indigo" },
  [SubscriptionStatus.ACTIVE]: { libelle: "Actif", ton: "vert" },
  [SubscriptionStatus.PAST_DUE]: { libelle: "Impayé", ton: "ocre" },
  [SubscriptionStatus.SUSPENDED]: { libelle: "Suspendu", ton: "brique" },
  [SubscriptionStatus.CANCELED]: { libelle: "Résilié", ton: "neutre" },
};

/** Un chiffre clé. Le libellé au-dessus, la précision en dessous, rien d'autre. */
function Tuile({
  mention,
  valeur,
  unite,
  precision,
  alerte = false,
}: {
  mention: string;
  valeur: string;
  unite?: string;
  precision?: string;
  alerte?: boolean;
}) {
  return (
    <div className="rounded-xl border border-reglure bg-card px-4 py-4">
      <p className="mention">{mention}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
        <span
          className={`titre chiffre text-2xl ${alerte ? "text-brique" : ""}`}
        >
          {valeur}
        </span>
        {unite && <span className="mention">{unite}</span>}
      </p>
      {precision && (
        <p className="mt-1.5 text-xs text-muted-foreground">{precision}</p>
      )}
    </div>
  );
}

/**
 * Consommation d'une entreprise face à son plan.
 *
 * C'est le signal commercial de la console : une PME qui frôle son plafond de
 * dépenses ou de scans est une PME à qui proposer le plan supérieur — et une
 * PME qui n'en consomme rien est une PME qui décroche. Les deux méritent un
 * appel, pour des raisons opposées.
 */
function Consommation({
  plan,
  releve,
}: {
  plan: SubscriptionPlan | null;
  releve: { depenses: number; ocr: number };
}) {
  if (!plan) {
    return <span className="text-muted-foreground">—</span>;
  }

  const quotas = PLANS[plan];

  return (
    <div className="flex flex-col gap-1">
      <Compteur
        libelle="dépenses"
        consomme={releve.depenses}
        quota={quotas.depensesParMois}
      />
      <Compteur libelle="OCR" consomme={releve.ocr} quota={quotas.ocrParMois} />
    </div>
  );
}

function Compteur({
  libelle,
  consomme,
  quota,
}: {
  libelle: string;
  consomme: number;
  quota: Quota;
}) {
  const illimite = estIllimite(quota);
  const part = illimite ? 0 : Math.round((consomme / quota) * 100);

  return (
    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span
        className={`chiffre ${
          !illimite && part >= 100
            ? "text-brique"
            : !illimite && part >= 80
              ? "text-ocre"
              : ""
        }`}
      >
        {formatNombre(consomme)}
      </span>
      <span className="text-muted-foreground">/ {formatQuota(quota)}</span>
      <span className="mention">{libelle}</span>
    </span>
  );
}

/**
 * Les onglets — des liens, pas un composant à état.
 *
 * `ui/tabs.tsx` existe et reste disponible pour des onglets internes à une
 * boîte de dialogue. Mais ici, changer de vue change ce que la page interroge :
 * un onglet React masquerait du contenu déjà chargé, alors qu'un lien laisse
 * l'URL décider. Bénéfice concret — une vue se met en favori, se partage, et
 * survit au tri d'une colonne.
 */
function Onglets({ vue, enAttente }: { vue: Vue; enAttente: number }) {
  const libelles: Record<Vue, string> = {
    finances: "Finances",
    entreprises: "Entreprises",
    utilisateurs: "Utilisateurs",
  };

  return (
    <nav
      aria-label="Sections de la console"
      className="mt-6 inline-flex gap-1 rounded-xl border border-reglure bg-card p-1"
    >
      {VUES.map((cible) => {
        const actif = cible === vue;
        return (
          <Link
            key={cible}
            href={`/editeur?vue=${cible}`}
            aria-current={actif ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              actif
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {libelles[cible]}
            {cible === "finances" && enAttente > 0 && (
              <span className="chiffre rounded-full bg-ocre/20 px-1.5 text-xs font-medium text-ocre">
                {enAttente}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Un en-tête de colonne triable.
 *
 * Cliquer la colonne déjà active inverse le sens ; cliquer une autre colonne
 * repart en ascendant. C'est la convention des tableurs, et un comptable en a
 * ouvert plus que des applications web.
 */
function ThTri({
  colonne,
  tri,
  descendant,
  aligne = "gauche",
  children,
}: {
  colonne: Tri;
  tri: Tri;
  descendant: boolean;
  aligne?: "gauche" | "droite";
  children: React.ReactNode;
}) {
  const actif = tri === colonne;
  const prochainSens = actif && !descendant ? "desc" : "asc";
  const Fleche = !actif ? ChevronsUpDown : descendant ? ArrowDown : ArrowUp;

  return (
    <th
      scope="col"
      className={`px-4 py-3 ${aligne === "droite" ? "text-right" : "text-left"}`}
      aria-sort={
        actif ? (descendant ? "descending" : "ascending") : "none"
      }
    >
      <Link
        href={`/editeur?vue=entreprises&tri=${colonne}&sens=${prochainSens}`}
        className={cn(
          "mention inline-flex items-center gap-1 rounded transition-colors hover:text-foreground",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          actif && "text-foreground",
          aligne === "droite" && "flex-row-reverse",
        )}
      >
        {children}
        <Fleche className="size-3 shrink-0" aria-hidden />
      </Link>
    </th>
  );
}

function Th({
  children,
  aligne = "gauche",
}: {
  children: React.ReactNode;
  aligne?: "gauche" | "droite";
}) {
  return (
    <th
      scope="col"
      className={`mention px-4 py-3 ${
        aligne === "droite" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  aligne = "gauche",
}: {
  children: React.ReactNode;
  aligne?: "gauche" | "droite";
}) {
  return (
    <td
      className={`px-4 py-3 align-top ${
        aligne === "droite" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}

/** Une échéance passée se signale d'elle-même : c'est de l'argent en retard. */
function Echeance({ date, maintenant }: { date: Date; maintenant: Date }) {
  const passee = date.getTime() < maintenant.getTime();
  return (
    <span className={passee ? "text-brique" : "text-muted-foreground"}>
      {formatDate(date)}
    </span>
  );
}

/* ------------------------------------------------------------------ */

/**
 * La file d'attente : les déclarations de paiement à rapprocher de Wave
 * Business. C'est la seule chose de cette page qui demande une action, donc
 * elle passe avant le reste.
 */
function FileDAttente({
  paiements,
}: {
  paiements: Awaited<ReturnType<typeof paiementsAVerifier>>;
}) {
  if (paiements.length === 0) {
    return (
      <Feuille className="mt-8" titre="Paiements à vérifier">
        <p className="text-sm text-muted-foreground">
          Rien en attente. Les déclarations apparaîtront ici dès qu&apos;un
          client aura dit avoir payé.
        </p>
      </Feuille>
    );
  }

  return (
    <section className="mt-8">
      <div className="rounded-xl border border-ocre/40 bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5">
          <h2 className="text-sm font-medium">
            {paiements.length} paiement{paiements.length > 1 ? "s" : ""} à
            vérifier
          </h2>
          <PastilleStatut ton="ocre">Action requise</PastilleStatut>
        </header>

        <p className="px-4 pt-2 text-sm text-muted-foreground md:px-5">
          Retrouvez le versement sur Wave Business, puis recopiez ici le montant
          que vous y constatez. Un écart marque le paiement en échec sans
          activer l&apos;abonnement.
        </p>

        <ul className="mt-4 divide-y divide-reglure border-t border-reglure">
          {paiements.map((paiement) => (
            <li key={paiement.id} className="px-4 py-4 md:px-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="code-compte">{paiement.reference}</span>
                <span className="chiffre font-medium">
                  {formatFCFA(paiement.amount)}
                </span>
              </div>

              <p className="mt-1 text-sm">
                {paiement.organization.name}
                <span className="text-muted-foreground">
                  {" · "}
                  {PLANS[paiement.plan].nom}
                  {" · déclaré le "}
                  {formatDate(paiement.updatedAt)}
                </span>
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Reçu Wave annoncé :{" "}
                <span className="code-compte text-foreground">
                  {paiement.providerTransactionId ?? "non communiqué"}
                </span>
              </p>

              <FormulaireEncaissement
                reference={paiement.reference}
                entreprise={paiement.organization.name}
                montantAttendu={paiement.amount}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Ce qui arrive à échéance sous quinze jours.
 *
 * Séparé du grand tableau, parce que ce n'est pas de la consultation : c'est
 * une liste d'appels à passer. Un essai qui se termine sans relance devient un
 * client perdu en silence — et personne n'ouvre un tableau de trente lignes
 * pour comparer des dates à la main.
 */
function ARelancer({
  entreprises,
  maintenant,
}: {
  entreprises: {
    id: string;
    name: string;
    subscription: { plan: SubscriptionPlan; status: SubscriptionStatus; currentPeriodEnd: Date } | null;
  }[];
  maintenant: Date;
}) {
  return (
    <section className="mt-8">
      <div className="rounded-xl border border-indigo/40 bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5">
          <h2 className="text-sm font-medium">
            {entreprises.length} échéance{entreprises.length > 1 ? "s" : ""} sous
            quinze jours
          </h2>
          <PastilleStatut ton="indigo">À relancer</PastilleStatut>
        </header>

        <ul className="mt-4 divide-y divide-reglure border-t border-reglure">
          {entreprises.map((entreprise) => {
            const abonnement = entreprise.subscription!;
            const jours = Math.max(
              0,
              Math.ceil(
                (abonnement.currentPeriodEnd.getTime() - maintenant.getTime()) /
                  86_400_000,
              ),
            );
            return (
              <li
                key={entreprise.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm md:px-5"
              >
                <span className="font-medium">{entreprise.name}</span>
                <span className="text-muted-foreground">
                  {ETATS[abonnement.status].libelle} ·{" "}
                  {PLANS[abonnement.plan].nom} ·{" "}
                  <span className="chiffre text-foreground">
                    {jours === 0 ? "aujourd’hui" : `dans ${jours} j`}
                  </span>{" "}
                  ({formatDate(abonnement.currentPeriodEnd)})
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * L'historique des paiements, tous statuts confondus.
 *
 * La file d'attente ne montre que ce qui reste à faire ; une fois validé, un
 * paiement en disparaît. Sans ce journal, l'éditeur n'aurait aucun moyen de
 * vérifier ce qu'il a encaissé la semaine dernière — ni de retrouver une
 * référence dictée au téléphone par un client qui conteste.
 */
function JournalPaiements({
  paiements,
}: {
  paiements: {
    id: string;
    reference: string;
    amount: number;
    status: PaymentStatus;
    plan: SubscriptionPlan;
    createdAt: Date;
    paidAt: Date | null;
    organization: { name: string };
  }[];
}) {
  if (paiements.length === 0) {
    return (
      <Feuille className="mt-10" titre="Journal des paiements">
        <p className="text-sm text-muted-foreground">
          Aucun paiement enregistré pour l&apos;instant.
        </p>
      </Feuille>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="mention">Journal des paiements</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Les {paiements.length} derniers, tous statuts confondus.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[42rem] border-separate border-spacing-0 overflow-hidden rounded-xl border border-reglure bg-card text-sm">
          <thead>
            <tr>
              <Th>Référence</Th>
              <Th>Entreprise</Th>
              <Th>Statut</Th>
              <Th aligne="droite">Montant</Th>
              <Th>Date</Th>
            </tr>
          </thead>
          <tbody>
            {paiements.map((paiement) => (
              <tr key={paiement.id} className="border-t border-reglure">
                <Td>
                  <span className="code-compte">{paiement.reference}</span>
                  <span className="mention mt-0.5 block">
                    {PLANS[paiement.plan].nom}
                  </span>
                </Td>
                <Td>{paiement.organization.name}</Td>
                <Td>
                  <PastilleStatut ton={ETATS_FACTURE[paiement.status].ton}>
                    {ETATS_FACTURE[paiement.status].libelle}
                  </PastilleStatut>
                </Td>
                <Td aligne="droite">
                  <span className="chiffre">{formatFCFA(paiement.amount)}</span>
                </Td>
                <Td>
                  <span className="text-muted-foreground">
                    {formatDate(paiement.paidAt ?? paiement.createdAt)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Mêmes tons que la page Abonnement d'un client : PENDING est neutre (il ne
 * s'est rien passé), AWAITING_VERIFICATION est ocre (quelque chose nous
 * attend). Un seul des deux réclame une action de notre part.
 */
const ETATS_FACTURE: Record<PaymentStatus, { libelle: string; ton: Ton }> = {
  [PaymentStatus.SUCCEEDED]: { libelle: "Encaissé", ton: "vert" },
  [PaymentStatus.AWAITING_VERIFICATION]: { libelle: "À vérifier", ton: "ocre" },
  [PaymentStatus.PENDING]: { libelle: "En attente", ton: "neutre" },
  [PaymentStatus.FAILED]: { libelle: "Échoué", ton: "brique" },
};

/* ------------------------------------------------------------------ */

type LigneUtilisateur = {
  id: string;
  nom: string;
  email: string;
  inscritLe: Date;
  adhesions: {
    role: Role;
    organization: { name: string; deletedAt: Date | null };
  }[];
};

/**
 * Les personnes inscrites sur la plateforme.
 *
 * La liste part de **Clerk**, pas de nos adhésions, et l'ordre compte : une
 * personne qui a créé un compte sans jamais rejoindre d'entreprise n'existe
 * pas dans notre base. Partir des adhésions la rendrait invisible — alors que
 * c'est précisément celle qu'il faut voir : quelqu'un s'est inscrit, puis a
 * abandonné avant d'aller au bout.
 */
function Utilisateurs({
  utilisateurs,
  monIdentifiant,
}: {
  utilisateurs: LigneUtilisateur[];
  monIdentifiant: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="mention">Utilisateurs</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-separate border-spacing-0 overflow-hidden rounded-xl border border-reglure bg-card text-sm">
          <thead>
            <tr>
              <Th>Personne</Th>
              <Th>Entreprises</Th>
              <Th>Inscrit le</Th>
            </tr>
          </thead>
          <tbody>
            {utilisateurs.map((utilisateur) => (
              <tr key={utilisateur.id} className="border-t border-reglure">
                <Td>
                  <span className="font-medium">
                    {utilisateur.nom}
                    {utilisateur.id === monIdentifiant && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (vous)
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-muted-foreground">
                    {utilisateur.email}
                  </span>
                  <span className="code-compte mt-0.5 block text-muted-foreground">
                    {utilisateur.id}
                  </span>
                </Td>

                <Td>
                  {utilisateur.adhesions.length === 0 ? (
                    // Inscrit mais jamais arrivé jusqu'à une entreprise :
                    // c'est un abandon en cours d'onboarding, pas un détail.
                    <PastilleStatut ton="ocre">Aucune entreprise</PastilleStatut>
                  ) : (
                    <ul className="space-y-1.5">
                      {utilisateur.adhesions.map((adhesion, index) => (
                        <li
                          key={`${adhesion.organization.name}-${index}`}
                          className="flex flex-wrap items-center gap-x-2 gap-y-1"
                        >
                          <span
                            className={
                              adhesion.organization.deletedAt
                                ? "text-muted-foreground line-through"
                                : ""
                            }
                          >
                            {adhesion.organization.name}
                          </span>
                          <span className="mention">
                            {ROLES[adhesion.role]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Td>

                <Td>
                  <span className="text-muted-foreground">
                    {formatDate(utilisateur.inscritLe)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function EnAttenteDePurge({
  entreprises,
}: {
  entreprises: { id: string; name: string; deletedAt: Date | null }[];
}) {
  return (
    <section className="mt-10">
      <h2 className="mention">Supprimées, en attente de purge</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Accès coupé immédiatement, données conservées {JOURS_DE_GRACE} jours,
        puis effacées définitivement par le cron de purge.
      </p>

      <ul className="mt-3 divide-y divide-reglure overflow-hidden rounded-xl border border-reglure bg-card">
        {entreprises.map((entreprise) => {
          const purgeLe = new Date(entreprise.deletedAt!);
          purgeLe.setDate(purgeLe.getDate() + JOURS_DE_GRACE);
          return (
            <li
              key={entreprise.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
            >
              <span>{entreprise.name}</span>
              <span className="text-muted-foreground">
                effacée le {formatDate(purgeLe)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
