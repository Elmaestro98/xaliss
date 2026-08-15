import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import {
  ChartColumnIncreasing,
  Check,
  Gauge,
  Minus,
  Receipt,
  Wallet,
} from "lucide-react";
import { ApercuJournal } from "@/components/apercu-journal";
import { BasculeTheme } from "@/components/bascule-theme";
import { Button } from "@/components/ui/button";
import { formatNombre } from "@/lib/format";
import {
  estIllimite,
  JOURS_ESSAI,
  MOIS_OFFERTS_ANNUEL,
  PLAN_PAR_DEFAUT,
  type Plan,
  PLANS_ORDONNES,
  planPermet,
  type Quota,
} from "@/lib/plans";

/**
 * Page d'accueil publique — PROJET.md §12, phase 8.
 *
 * La grille tarifaire est lue dans `lib/plans.ts`, jamais recopiée. C'est le
 * même fichier qui décide côté serveur si une entreprise a droit aux notes de
 * frais : la page publique ne peut donc pas annoncer un prix ou un quota que
 * l'application ne pratique pas. Une landing page qui ment sur le tarif, c'est
 * un litige, pas une faute de frappe.
 *
 * Le mouvement est concentré en un seul endroit — le graphe du héros, qui se
 * trace à l'ouverture (`ApercuJournal`). Le reste de la page se contente
 * d'apparaître au défilement, du même geste partout. Une page où chaque bloc
 * a son effet propre ne se lit plus, elle se subit.
 */
export default function Accueil() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <EnTete />

      <main className="flex-1">
        <Heros />
        <Probleme />
        <Modules />
        <PourquoiLocal />
        <Tarifs />
        <AppelFinal />
      </main>

      <PiedDePage />
    </div>
  );
}

/* ── En-tête ─────────────────────────────────────────────────────── */

function EnTete() {
  return (
    <header className="sticky top-0 z-50 border-b border-reglure bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link
          href="/"
          className="titre rounded-lg text-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Xaalis
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <LienDiscret href="#modules">Fonctionnalités</LienDiscret>
          <LienDiscret href="#tarifs">Tarifs</LienDiscret>
        </nav>

        <div className="flex items-center gap-2">
          <BasculeTheme />

          <Show when="signed-out">
            <Button variant="ghost" asChild className="hidden h-9 px-3 sm:flex">
              <Link href="/sign-in">Connexion</Link>
            </Button>
            <Button asChild className="h-9 px-4">
              <Link href="/sign-up">Essayer</Link>
            </Button>
          </Show>

          <Show when="signed-in">
            <Button asChild className="h-9 px-4">
              <Link href="/dashboard">Tableau de bord</Link>
            </Button>
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}

/** Un lien de texte courant : discret, mais toujours atteignable au clavier. */
function LienDiscret({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const Composant = href.startsWith("#") ? "a" : Link;
  return (
    <Composant
      href={href}
      className="rounded-lg transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {children}
    </Composant>
  );
}

/* ── Titres de section ───────────────────────────────────────────── */

/**
 * L'en-tête de page du registre : une mention, un filet, un titre.
 *
 * Le filet n'est pas un ornement — c'est le trait qui sépare deux pages du
 * cahier, et la mention porte une information que le titre ne dit pas (un
 * décompte, un prix d'entrée, un pays). Une étiquette qui répéterait le titre
 * en plus petit ne mériterait pas la ligne qu'elle occupe.
 */
function TitreSection({
  mention,
  children,
}: {
  mention: string;
  children: React.ReactNode;
}) {
  return (
    <header className="revele">
      <p className="mention">{mention}</p>
      <span aria-hidden className="mt-3 block h-px w-full bg-reglure" />
      <h2 className="titre mt-6 max-w-3xl text-3xl md:text-4xl">{children}</h2>
    </header>
  );
}

/* ── Héros ───────────────────────────────────────────────────────── */

function retard(ms: number) {
  return { "--retard": `${ms}ms` } as React.CSSProperties;
}

function Heros() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8 md:py-24 lg:py-28">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
        <div>
          <h1
            className="anim-monte titre text-4xl sm:text-5xl lg:text-6xl"
            style={retard(60)}
          >
            Tenez le cahier de vos dépenses, plus la pile de reçus.
          </h1>

          <p
            className="anim-monte mt-6 max-w-xl text-lg text-muted-foreground"
            style={retard(150)}
          >
            Xaalis suit les dépenses, budgets et notes de frais de votre PME.
            En FCFA, payable par Wave, sans carte bancaire.
          </p>

          <div
            className="anim-monte mt-9 flex flex-col gap-3 sm:flex-row"
            style={retard(240)}
          >
            <Show when="signed-out">
              <Button asChild className="h-11 px-6 text-sm">
                <Link href="/sign-up">
                  Essayer {JOURS_ESSAI} jours gratuitement
                </Link>
              </Button>
            </Show>
            <Show when="signed-in">
              <Button asChild className="h-11 px-6 text-sm">
                <Link href="/dashboard">Ouvrir mon tableau de bord</Link>
              </Button>
            </Show>

            <Button variant="outline" asChild className="h-11 px-6 text-sm">
              <a href="#tarifs">Voir les tarifs</a>
            </Button>
          </div>

          <p
            className="anim-monte mt-6 text-sm text-muted-foreground"
            style={retard(330)}
          >
            Sans engagement · Sans carte bancaire · Interface en français
          </p>
        </div>

        <ApercuJournal />
      </div>
    </section>
  );
}

/* ── Le constat ──────────────────────────────────────────────────── */

const CONSTATS = [
  {
    titre: "Le reçu au fond de la poche",
    texte:
      "Il est froissé, illisible, ou perdu. Au moment du bilan, la dépense n'existe plus.",
  },
  {
    titre: "Le budget dépassé la semaine dernière",
    texte:
      "Personne ne l'a vu passer. On l'apprend en fin de mois, quand il est trop tard pour corriger.",
  },
  {
    titre: "Le bilan qui prend trois jours",
    texte:
      "Recopier Excel, retrouver les justificatifs, tout recompter à la main.",
  },
];

function Probleme() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8 md:py-24">
      <TitreSection mention="Avant Xaalis">
        Aujourd&apos;hui, ça se passe comme ça.
      </TitreSection>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {CONSTATS.map((constat) => (
          <article key={constat.titre} className="revele">
            <Carte>
              <h3 className="text-base font-medium">{constat.titre}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {constat.texte}
              </p>
            </Carte>
          </article>
        ))}
      </div>
    </section>
  );
}

/** La feuille de la page d'accueil : le filet se réchauffe au survol. */
function Carte({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`h-full rounded-xl border border-reglure bg-card px-5 py-5 transition-colors duration-200 hover:border-indigo/50 ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Les modules ─────────────────────────────────────────────────── */

// Les mêmes icônes que la navigation de l'application : la page d'accueil
// enseigne déjà le vocabulaire visuel que le client retrouvera à l'intérieur.
const MODULES = [
  {
    icone: Receipt,
    titre: "Dépenses",
    texte:
      "Photographiez le reçu, Xaalis lit le montant, la date et le fournisseur. Vous validez, c'est enregistré.",
  },
  {
    icone: Gauge,
    titre: "Budgets",
    texte:
      "Une jauge par catégorie. Alerte par e-mail à 80 % et à 100 %, avant le dépassement, pas après.",
  },
  {
    icone: Wallet,
    titre: "Notes de frais",
    texte:
      "L'employé soumet depuis son téléphone. Vous approuvez d'un geste. Chaque décision est tracée.",
  },
  {
    icone: ChartColumnIncreasing,
    titre: "Rapports",
    texte:
      "Journal en Excel, synthèse mensuelle en PDF, catégories alignées SYSCOHADA. Prêt pour le comptable.",
  },
];

function Modules() {
  return (
    <section
      id="modules"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 md:px-8 md:py-24"
    >
      <TitreSection mention="Quatre modules">
        Ce que Xaalis fait à la place.
      </TitreSection>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {MODULES.map((module) => {
          const Icone = module.icone;
          return (
            <article key={module.titre} className="revele">
              <Carte className="sm:px-6 sm:py-6">
                <Icone className="size-5 text-indigo" aria-hidden />
                <h3 className="mt-4 text-lg font-medium">{module.titre}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {module.texte}
                </p>
              </Carte>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/* ── L'ancrage local ─────────────────────────────────────────────── */

const PREUVES = [
  { titre: "FCFA", texte: "Les montants sont des entiers, sans centimes." },
  { titre: "Wave", texte: "Payez votre abonnement depuis votre téléphone." },
  {
    titre: "SYSCOHADA",
    texte: "Les vrais numéros de compte : 601, 6053, 622.",
  },
  { titre: "Français", texte: "Toute l'interface, y compris le support." },
];

/**
 * La seule section qui rompt le rythme des cartes : une bande pleine largeur,
 * quatre mots en grand, sans cadre. C'est l'argument qui distingue Xaalis
 * d'Expensify et de Spendesk (PROJET.md §1) — il mérite de ne ressembler à
 * aucune autre section de la page.
 */
function PourquoiLocal() {
  return (
    <section className="border-y border-reglure bg-card">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8 md:py-24">
        <TitreSection mention="Sénégal">Pensé ici, pas traduit.</TitreSection>

        <dl className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {PREUVES.map((preuve) => (
            <div key={preuve.titre} className="revele">
              <dt className="titre text-2xl text-indigo md:text-3xl">
                {preuve.titre}
              </dt>
              <dd className="mt-3 text-sm text-muted-foreground">
                {preuve.texte}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ── Les tarifs ──────────────────────────────────────────────────── */

/** « 3 utilisateurs » / « Utilisateurs illimités » — l'illimité n'est pas un nombre. */
function ligneQuota(quota: Quota, unite: string, uniteIllimitee: string) {
  if (estIllimite(quota)) return uniteIllimitee;
  return `${formatNombre(quota)} ${unite}`;
}

function lignesPlan(plan: Plan) {
  return [
    {
      texte: ligneQuota(
        plan.utilisateurs,
        "utilisateurs",
        "Utilisateurs illimités",
      ),
      inclus: true,
    },
    {
      texte: ligneQuota(
        plan.depensesParMois,
        "dépenses par mois",
        "Dépenses illimitées",
      ),
      inclus: true,
    },
    {
      texte: ligneQuota(
        plan.ocrParMois,
        "scans OCR par mois",
        "Scans OCR illimités",
      ),
      inclus: true,
    },
    { texte: "Budgets et alertes e-mail", inclus: true },
    { texte: "Export PDF", inclus: true },
    { texte: "Notes de frais", inclus: planPermet(plan.code, "notes-de-frais") },
    { texte: "Alertes SMS", inclus: planPermet(plan.code, "alertes-sms") },
    { texte: "Export Excel", inclus: planPermet(plan.code, "export-excel") },
    { texte: `Support : ${plan.support}`, inclus: true },
  ];
}

function Tarifs() {
  const prixDEntree = PLANS_ORDONNES[0].prixMensuel;

  return (
    <section
      id="tarifs"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 md:px-8 md:py-24"
    >
      <TitreSection mention={`À partir de ${formatNombre(prixDEntree)} FCFA`}>
        Trois plans, en francs CFA.
      </TitreSection>

      <p className="revele mt-4 max-w-2xl text-sm text-muted-foreground">
        Payés à l&apos;année, {MOIS_OFFERTS_ANNUEL} mois sont offerts. Le détail
        et le paiement se règlent une fois votre entreprise créée.
      </p>

      {/* Sans étirement, la carte mise en avant (plus rembourrée) dépasserait
          les deux autres et la grille pencherait. */}
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {PLANS_ORDONNES.map((plan) => (
          <div key={plan.code} className="revele h-full">
            <CartePlan
              plan={plan}
              // La mise en avant suit le plan sur lequel démarre un essai, elle
              // n'est pas un choix commercial posé ici. Si `PLAN_PAR_DEFAUT`
              // change, la page suit — sans quoi on vanterait un plan que
              // personne ne reçoit en s'inscrivant.
              enAvant={plan.code === PLAN_PAR_DEFAUT}
            />
          </div>
        ))}
      </div>

      <p className="revele mt-8 text-sm text-muted-foreground">
        Essai gratuit de {JOURS_ESSAI} jours sur tous les plans. Aucune carte
        bancaire demandée.
      </p>
    </section>
  );
}

function CartePlan({ plan, enAvant }: { plan: Plan; enAvant: boolean }) {
  return (
    <div
      className={`flex h-full flex-col rounded-xl border bg-card px-5 transition-colors duration-200 ${
        enAvant
          ? "border-indigo py-7 lg:px-6"
          : "border-reglure py-5 hover:border-indigo/50"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="titre text-xl">{plan.nom}</h3>
        {enAvant && (
          <span className="rounded-full bg-indigo/15 px-2.5 py-1 text-xs font-medium text-indigo">
            Le plus choisi
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{plan.argumentaire}</p>

      <p className="mt-6 flex items-baseline gap-2">
        <span className="titre chiffre text-4xl">
          {formatNombre(plan.prixMensuel)}
        </span>
        <span className="mention">FCFA / mois</span>
      </p>

      <Button
        asChild
        variant={enAvant ? "default" : "outline"}
        className="mt-6 h-10"
      >
        <Link href="/sign-up">Commencer avec {plan.nom}</Link>
      </Button>

      <ul className="mt-7 space-y-2.5 border-t border-reglure pt-6 text-sm">
        {lignesPlan(plan).map((ligne) => (
          <li
            key={ligne.texte}
            className={`flex items-baseline gap-2 ${
              ligne.inclus ? "" : "text-muted-foreground"
            }`}
          >
            {ligne.inclus ? (
              <Check
                className="size-3.5 shrink-0 translate-y-0.5 text-vert"
                aria-hidden
              />
            ) : (
              <Minus
                className="size-3.5 shrink-0 translate-y-0.5 text-muted-foreground"
                aria-hidden
              />
            )}
            <span>{ligne.texte}</span>
            <span className="sr-only">
              {ligne.inclus ? " (inclus)" : " (non inclus)"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Appel final ─────────────────────────────────────────────────── */

function AppelFinal() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-8">
      <div className="revele rounded-xl border border-reglure bg-card px-6 py-16 text-center md:py-20">
        <h2 className="titre mx-auto max-w-2xl text-3xl md:text-4xl">
          Commencez par la dernière dépense que vous avez payée.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
          Créez votre entreprise en deux minutes. Les {JOURS_ESSAI} premiers
          jours sont gratuits.
        </p>
        <Show when="signed-out">
          <Button asChild className="mt-8 h-11 px-6 text-sm">
            <Link href="/sign-up">Créer mon compte</Link>
          </Button>
        </Show>
        <Show when="signed-in">
          <Button asChild className="mt-8 h-11 px-6 text-sm">
            <Link href="/depenses/nouvelle">Saisir une dépense</Link>
          </Button>
        </Show>
      </div>
    </section>
  );
}

/* ── Pied de page ────────────────────────────────────────────────── */

function PiedDePage() {
  return (
    <footer className="border-t border-reglure">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 md:px-8">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <p className="mention">Produit</p>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li>
                <LienDiscret href="#modules">Fonctionnalités</LienDiscret>
              </li>
              <li>
                <LienDiscret href="#tarifs">Tarifs</LienDiscret>
              </li>
              <li>
                <LienDiscret href="/sign-in">Connexion</LienDiscret>
              </li>
            </ul>
          </div>

          <div>
            <p className="mention">Contact</p>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li>
                <a
                  href="mailto:africatechnologie9@gmail.com"
                  className="rounded-lg transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  africatechnologie9@gmail.com
                </a>
              </li>
              <li>
                <a
                  href="tel:+221768431263"
                  className="chiffre rounded-lg transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  +221 76 843 12 63
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="mention">Éditeur</p>
            <p className="mt-4 text-sm text-muted-foreground">
              AFRICATECHNOLOGIE / E-DEV
              <br />
              Saint-Louis / Dakar, Sénégal
            </p>
          </div>
        </div>

        <div className="mt-12 border-t border-reglure pt-6">
          <p className="text-xs text-muted-foreground">
            Xaalis — « l&apos;argent » en wolof. Données hébergées et traitées
            conformément à la loi sénégalaise n° 2008-12.
          </p>
        </div>
      </div>
    </footer>
  );
}
