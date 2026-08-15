import Link from "next/link";
import { Check, Minus } from "lucide-react";
import {
  BillingCycle,
  PaymentStatus,
  SubscriptionPlan,
} from "@/generated/prisma/enums";
import { BoutonSouscrire } from "@/components/bouton-souscrire";
import { PastilleStatut, type Ton } from "@/components/pastille-statut";
import { etatAbonnement, getAbonnement } from "@/lib/abonnement";
import { formatDate, formatFCFA, formatNombre } from "@/lib/format";
import { can } from "@/lib/permissions";
import {
  economieAnnuelle,
  estIllimite,
  formatQuota,
  MOIS_OFFERTS_ANNUEL,
  PLANS,
  PLANS_ORDONNES,
  prixPour,
  type Quota,
} from "@/lib/plans";
import { paiementConfigure } from "@/lib/lien-wave";
import { prisma } from "@/lib/prisma";
import { releveConsommation } from "@/lib/quotas";
import { requireSession } from "@/lib/session";

/**
 * Abonnement de l'entreprise (PROJET.md §4.5 et §11).
 *
 * Réservée au gérant : `subscription:manage` n'appartient qu'à ADMIN. La
 * navigation masque déjà l'entrée, mais la page se protège elle-même —
 * l'interface ne fait jamais autorité (PROJET.md §5).
 */
export default async function AbonnementPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const session = await requireSession();

  if (!can(session.role, "subscription:manage")) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 md:px-8">
        <h1 className="titre text-2xl">Réservé au gérant</h1>
        <p className="mt-3 text-muted-foreground">
          L&apos;abonnement de l&apos;entreprise est géré par le gérant.
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

  const params = await searchParams;
  const cycle =
    params.cycle === "annee" ? BillingCycle.YEARLY : BillingCycle.MONTHLY;

  const [abonnement, factures] = await Promise.all([
    getAbonnement(session.organizationId),
    prisma.payment.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
  ]);

  const etat = etatAbonnement(abonnement);
  const consommation = await releveConsommation(
    etat.plan,
    session.organizationId,
  );

  // Le plus récent des paiements non aboutis : les factures sont déjà triées
  // du plus récent au plus ancien, inutile d'interroger la base à nouveau.
  const paiementEnCours = factures.find(
    (facture) =>
      facture.status === PaymentStatus.PENDING ||
      facture.status === PaymentStatus.AWAITING_VERIFICATION,
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="titre text-2xl md:text-3xl">Abonnement</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ce que votre entreprise paie pour Xaalis
      </p>

      {/*
        Un paiement en cours passe avant l'état de l'abonnement : c'est
        l'action que le gérant a laissée en suspens, et le paiement se fait
        hors de Xaalis — sans ce rappel, une souscription commencée puis
        interrompue serait perdue de vue.
      */}
      {paiementEnCours && (
        <section className="mt-6 rounded-xl border border-l-2 border-reglure border-l-ocre bg-card px-5 py-4">
          <h2 className="titre text-lg">
            {paiementEnCours.status === PaymentStatus.AWAITING_VERIFICATION
              ? "Paiement en cours de vérification"
              : "Paiement à finaliser"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {paiementEnCours.status === PaymentStatus.AWAITING_VERIFICATION
              ? `Votre déclaration pour le plan ${PLANS[paiementEnCours.plan].nom} est enregistrée. L'activation suit la vérification du versement.`
              : `Plan ${PLANS[paiementEnCours.plan].nom} — ${formatFCFA(paiementEnCours.amount)} restent à régler par Wave.`}
          </p>
          <Link
            href={`/abonnement/paiement/${paiementEnCours.reference}`}
            className="mt-3 inline-block text-sm text-indigo underline underline-offset-4"
          >
            {paiementEnCours.status === PaymentStatus.AWAITING_VERIFICATION
              ? "Voir le détail"
              : "Reprendre le paiement"}
          </Link>
        </section>
      )}

      <EtatCourant etat={etat} />

      {/* Consommation du mois : ce qui décide si un plan suffit encore. */}
      <section className="mt-8">
        <h2 className="mention">
          Consommation du mois
        </h2>
        <div className="mt-2 grid gap-px overflow-hidden rounded-xl border border-reglure bg-reglure sm:grid-cols-2">
          <Jauge
            libelle="Dépenses saisies"
            consomme={consommation.depenses.consomme}
            quota={consommation.depenses.quota}
          />
          <Jauge
            libelle="Scans OCR"
            consomme={consommation.ocr.consomme}
            quota={consommation.ocr.quota}
          />
        </div>
      </section>

      {/* Périodicité : l'état vit dans l'URL, comme les filtres des dépenses. */}
      <section className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="titre text-xl">Changer de plan</h2>
          <div className="flex items-center gap-1 rounded-xl border border-reglure bg-card p-0.5 text-sm">
            <LienCycle actif={cycle === BillingCycle.MONTHLY} vers="?cycle=mois">
              Mensuel
            </LienCycle>
            <LienCycle
              actif={cycle === BillingCycle.YEARLY}
              vers="?cycle=annee"
            >
              Annuel
            </LienCycle>
          </div>
        </div>
        {cycle === BillingCycle.YEARLY && (
          <p className="mt-2 text-sm text-vert">
            {MOIS_OFFERTS_ANNUEL} mois offerts : vous ne payez que 10 mois sur
            12.
          </p>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {PLANS_ORDONNES.map((plan) => (
            <CartePlan
              key={plan.code}
              plan={plan.code}
              cycle={cycle}
              estPlanCourant={
                etat.type === "actif" && abonnement.plan === plan.code
              }
            />
          ))}
        </div>

        {!paiementConfigure && (
          <p className="mt-4 rounded-xl border border-l-2 border-reglure border-l-ocre bg-card px-5 py-3 text-sm text-muted-foreground">
            Le paiement Wave n&apos;est pas encore configuré. Contactez le
            support pour souscrire.
          </p>
        )}
      </section>

      {/* Factures — PROJET.md §4.5 */}
      <section className="mt-12">
        <h2 className="titre text-xl">Factures</h2>
        {factures.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Aucun paiement pour l&apos;instant. Vos factures apparaîtront ici.
          </p>
        ) : (
          <ul className="papier-regle mt-4 divide-y divide-reglure overflow-hidden rounded-xl border border-reglure bg-card">
            {factures.map((facture) => (
              <li
                key={facture.id}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-3"
              >
                <span className="code-compte text-xs text-muted-foreground">
                  {facture.reference}
                </span>
                <span className="text-sm">
                  {PLANS[facture.plan].nom}
                  <span className="text-muted-foreground">
                    {" · "}
                    {facture.billingCycle === BillingCycle.YEARLY
                      ? "annuel"
                      : "mensuel"}
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {formatDate(facture.paidAt ?? facture.createdAt)}
                </span>
                <span className="chiffre ml-auto text-sm">
                  {formatFCFA(facture.amount)}
                </span>
                <EtatFacture statut={facture.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Une jauge de consommation. Les couleurs reprennent celles des budgets
 * (PROJET.md §6) : sous le seuil, à l'approche, au plafond — un utilisateur
 * qui a appris à les lire sur ses budgets les relit ici sans effort.
 */
function Jauge({
  libelle,
  consomme,
  quota,
}: {
  libelle: string;
  consomme: number;
  quota: Quota;
}) {
  if (estIllimite(quota)) {
    return (
      <div className="bg-card px-5 py-4">
        <p className="text-xs text-muted-foreground">{libelle}</p>
        <p className="mt-1">
          <span className="chiffre text-xl">{formatNombre(consomme)}</span>
          <span className="text-sm text-muted-foreground"> · illimité</span>
        </p>
      </div>
    );
  }

  const part = Math.min(100, Math.round((consomme / quota) * 100));
  const teinte =
    part >= 100 ? "bg-brique" : part >= 80 ? "bg-ocre" : "bg-vert";

  return (
    <div className="bg-card px-5 py-4">
      <p className="text-xs text-muted-foreground">{libelle}</p>
      <p className="mt-1">
        <span className="chiffre text-xl">{formatNombre(consomme)}</span>
        <span className="text-sm text-muted-foreground">
          {" "}
          / {formatQuota(quota)}
        </span>
      </p>
      {/* Même règle que les jauges de budget : le quota restant est réglé,
          pas grisé — c'est du disponible, pas du vide. */}
      <div
        className="regle-texture mt-2.5 h-1.5 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`${part} % du quota consommé`}
      >
        <div
          className={`h-full rounded-full ${teinte}`}
          style={{ width: `${part}%` }}
        />
      </div>
    </div>
  );
}

function LienCycle({
  actif,
  vers,
  children,
}: {
  actif: boolean;
  vers: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={vers}
      aria-current={actif ? "true" : undefined}
      className={
        actif
          ? "bg-indigo px-3 py-1 text-white"
          : "px-3 py-1 text-muted-foreground hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

/** Le bandeau d'état : ce que le gérant doit savoir avant tout le reste. */
function EtatCourant({
  etat,
}: {
  etat: ReturnType<typeof etatAbonnement>;
}) {
  const contenu = (() => {
    switch (etat.type) {
      case "essai":
        return {
          bord: etat.joursRestants <= 3 ? "border-l-ocre" : "border-l-indigo",
          titre: `Essai gratuit — ${etat.joursRestants} jour${
            etat.joursRestants > 1 ? "s" : ""
          } restant${etat.joursRestants > 1 ? "s" : ""}`,
          detail: `Vous testez le plan ${PLANS[etat.plan].nom} jusqu'au ${formatDate(
            etat.fin,
          )}. Choisissez un plan avant cette date pour ne pas interrompre le service.`,
        };
      case "actif":
        return {
          bord: "border-l-vert",
          titre: `Plan ${PLANS[etat.plan].nom} — actif`,
          detail: `Renouvellement le ${formatDate(etat.fin)} (paiement ${
            etat.cycle === BillingCycle.YEARLY ? "annuel" : "mensuel"
          }).`,
        };
      case "impaye":
        return {
          bord: "border-l-ocre",
          titre: `Paiement en attente — ${etat.joursRestants} jour${
            etat.joursRestants > 1 ? "s" : ""
          } avant suspension`,
          detail: `Votre accès reste complet jusqu'au ${formatDate(
            etat.suspensionLe,
          )}. Passé cette date, Xaalis passe en lecture seule : vos données restent consultables, mais la saisie est bloquée.`,
        };
      case "suspendu":
        return {
          bord: "border-l-brique",
          titre: "Abonnement suspendu — lecture seule",
          detail:
            "Vos données sont intactes et consultables. Réglez un plan pour rouvrir la saisie.",
        };
      case "resilie":
        return {
          bord: "border-l-brique",
          titre: "Abonnement résilié",
          detail:
            "Vos données restent consultables. Choisissez un plan pour reprendre.",
        };
    }
  })();

  return (
    <section
      className={`mt-6 rounded-xl border border-l-2 border-reglure bg-card px-5 py-4 ${contenu.bord}`}
    >
      <h2 className="titre text-lg">{contenu.titre}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{contenu.detail}</p>
    </section>
  );
}

function CartePlan({
  plan,
  cycle,
  estPlanCourant,
}: {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  estPlanCourant: boolean;
}) {
  const details = PLANS[plan];
  const prix = prixPour(plan, cycle);
  const annuel = cycle === BillingCycle.YEARLY;

  return (
    <article
      className={`flex flex-col border bg-card px-5 py-5 ${
        estPlanCourant ? "border-indigo" : "border-reglure"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="titre text-lg">{details.nom}</h3>
        {estPlanCourant && (
          <span className="code-compte text-xs uppercase text-indigo">
            Plan actuel
          </span>
        )}
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        {details.argumentaire}
      </p>

      <p className="mt-4">
        <span className="chiffre titre text-2xl">{formatNombre(prix)}</span>
        <span className="text-sm text-muted-foreground">
          {" FCFA "}/{annuel ? "an" : "mois"}
        </span>
      </p>
      {annuel && (
        <p className="text-xs text-vert">
          Soit {formatFCFA(economieAnnuelle(plan))} économisés
        </p>
      )}

      <ul className="mt-5 flex-1 space-y-1.5 text-sm">
        <Ligne>{formatQuota(details.utilisateurs)} utilisateurs</Ligne>
        <Ligne>{formatQuota(details.depensesParMois)} dépenses / mois</Ligne>
        <Ligne>{formatQuota(details.ocrParMois)} scans OCR / mois</Ligne>
        <Ligne>Budgets et alertes email</Ligne>
        <Ligne inclus={details.fonctionnalites.includes("notes-de-frais")}>
          Notes de frais
        </Ligne>
        <Ligne inclus={details.fonctionnalites.includes("alertes-sms")}>
          Alertes SMS
        </Ligne>
        <Ligne inclus={details.fonctionnalites.includes("export-excel")}>
          Export Excel
        </Ligne>
        <Ligne>Export PDF</Ligne>
        <Ligne>Support : {details.support}</Ligne>
      </ul>

      <BoutonSouscrire
        plan={plan}
        cycle={cycle}
        libelle={estPlanCourant ? "Renouveler" : "Choisir ce plan"}
        variante={estPlanCourant ? "outline" : "default"}
      />
    </article>
  );
}

function Ligne({
  children,
  inclus = true,
}: {
  children: React.ReactNode;
  inclus?: boolean;
}) {
  const Icone = inclus ? Check : Minus;
  return (
    <li
      className={`flex items-baseline gap-2 ${
        inclus ? "" : "text-muted-foreground line-through"
      }`}
    >
      <Icone
        className={`size-3.5 shrink-0 translate-y-0.5 ${
          inclus ? "text-vert" : "text-muted-foreground"
        }`}
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}

/**
 * PENDING est neutre, AWAITING_VERIFICATION est ocre — la nuance n'est pas
 * cosmétique. « En attente » veut dire que le client n'a rien déclaré : il ne
 * s'est rien passé. « À vérifier » veut dire qu'il affirme avoir payé et que
 * l'éditeur doit aller regarder Wave Business (PROJET.md §9). Un seul de ces
 * deux états réclame une action de notre part, et c'est celui-là qu'on teinte.
 */
const ETATS_FACTURE: Record<PaymentStatus, { libelle: string; ton: Ton }> = {
  [PaymentStatus.SUCCEEDED]: { libelle: "Payée", ton: "vert" },
  [PaymentStatus.AWAITING_VERIFICATION]: {
    libelle: "À vérifier",
    ton: "ocre",
  },
  [PaymentStatus.PENDING]: { libelle: "En attente", ton: "neutre" },
  [PaymentStatus.FAILED]: { libelle: "Échouée", ton: "brique" },
};

function EtatFacture({ statut }: { statut: PaymentStatus }) {
  const etat = ETATS_FACTURE[statut];
  return <PastilleStatut ton={etat.ton}>{etat.libelle}</PastilleStatut>;
}
