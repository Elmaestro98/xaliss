import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { BillingCycle, PaymentStatus } from "@/generated/prisma/enums";
import { FormulaireDeclarationPaiement } from "@/components/formulaire-declaration-paiement";
import { formatFCFA, formatNombre } from "@/lib/format";
import { LIEN_WAVE } from "@/lib/lien-wave";
import { can } from "@/lib/permissions";
import { PLANS } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

/**
 * Instructions de paiement — PROJET.md §9.
 *
 * Le lien Wave est à montant libre : c'est donc cet écran qui fait autorité sur
 * la somme à saisir. Il l'affiche en grand, avec la référence à inscrire en
 * motif — sans elle, un versement arrive sur le portefeuille marchand sans
 * qu'on sache de quelle entreprise il vient.
 */
export default async function PaiementPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const session = await requireSession();
  const { reference } = await params;

  if (!can(session.role, "subscription:manage")) notFound();

  const paiement = await prisma.payment.findFirst({
    // organizationId dans le where : la référence circule dans l'URL, et le
    // paiement d'une autre entreprise doit être introuvable, pas interdit.
    where: { reference, organizationId: session.organizationId },
  });
  if (!paiement) notFound();

  const plan = PLANS[paiement.plan];
  const annuel = paiement.billingCycle === BillingCycle.YEARLY;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <Link
        href="/abonnement"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Abonnement
      </Link>

      <h1 className="titre mt-3 text-2xl md:text-3xl">
        Payer le plan {plan.nom}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Abonnement {annuel ? "annuel" : "mensuel"} · règlement par Wave
      </p>

      {paiement.status === PaymentStatus.SUCCEEDED ? (
        <section className="mt-8 rounded-xl border border-l-2 border-reglure border-l-vert bg-card px-5 py-4">
          <h2 className="titre text-lg text-vert">Paiement encaissé</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Votre plan {plan.nom} est actif. Cette facture porte la référence{" "}
            <span className="code-compte">{paiement.reference}</span>.
          </p>
        </section>
      ) : paiement.status === PaymentStatus.AWAITING_VERIFICATION ? (
        <section className="mt-8 rounded-xl border border-l-2 border-reglure border-l-ocre bg-card px-5 py-4">
          <h2 className="titre text-lg">Vérification en cours</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Nous avons bien reçu votre déclaration (transaction{" "}
            <span className="code-compte">{paiement.providerTransactionId}</span>
            ). Votre plan sera activé dès que le versement aura été constaté —
            généralement sous quelques heures ouvrées. Vous n&apos;avez rien
            d&apos;autre à faire.
          </p>
        </section>
      ) : (
        <>
          {/* Le montant d'abord : c'est ce que le client doit saisir dans Wave. */}
          <section className="mt-8 rounded-xl border border-reglure bg-card px-5 py-5">
            <h2 className="mention">
              Montant à envoyer
            </h2>
            <p className="mt-1">
              <span className="chiffre titre text-4xl">
                {formatNombre(paiement.amount)}
              </span>
              <span className="ml-2 text-muted-foreground">FCFA</span>
            </p>

            <h2 className="code-compte mt-6 uppercase text-muted-foreground">
              Référence à indiquer en motif
            </h2>
            <p className="code-compte mt-1 text-lg">{paiement.reference}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Sans cette référence, nous ne pouvons pas rattacher votre
              versement à votre entreprise.
            </p>
          </section>

          <ol className="mt-8 space-y-4">
            <Etape numero="1">
              Ouvrez Wave et envoyez exactement{" "}
              <strong>{formatFCFA(paiement.amount)}</strong>, en indiquant{" "}
              <span className="code-compte">{paiement.reference}</span> en motif.
              {LIEN_WAVE ? (
                <a
                  href={LIEN_WAVE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-reglure bg-card px-4 py-2 text-sm text-indigo underline-offset-4 hover:underline"
                >
                  Ouvrir le paiement Wave
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : (
                <span className="mt-3 block text-brique">
                  Le lien de paiement n&apos;est pas configuré. Contactez le
                  support.
                </span>
              )}
            </Etape>

            <Etape numero="2">
              Revenez ici et déclarez votre paiement en recopiant
              l&apos;identifiant de transaction figurant sur votre reçu Wave.
              <FormulaireDeclarationPaiement reference={paiement.reference} />
            </Etape>

            <Etape numero="3">
              Nous vérifions le versement, puis votre plan est activé. Vous
              recevrez la confirmation par email.
            </Etape>
          </ol>
        </>
      )}
    </div>
  );
}

/**
 * Une étape numérotée. La numérotation reprend la logique du cahier : un
 * numéro en chiffres tabulaires, posé dans la marge (PROJET.md §6).
 */
function Etape({
  numero,
  children,
}: {
  numero: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 border-b border-reglure pb-4 last:border-0">
      <span className="code-compte shrink-0 text-muted-foreground">
        {numero}
      </span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </li>
  );
}
