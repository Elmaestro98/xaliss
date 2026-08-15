import type { NextRequest } from "next/server";
import {
  echouerPaiement,
  encaisserPaiement,
  paiementsAVerifier,
} from "@/lib/facturation";

/**
 * Validation manuelle des paiements d'abonnement — PROJET.md §9.
 *
 * Depuis que Xaalis encaisse sur un lien de paiement Wave, aucun webhook signé
 * ne vient confirmer un versement : l'activation est un geste de l'éditeur.
 * Cette route est ce geste, et `scripts/valider-paiement.ts` en est la façade.
 *
 * Elle passe par les MÊMES fonctions que le reste de la facturation
 * (`encaisserPaiement`) plutôt que de refaire l'activation dans un script :
 * deux chemins d'encaissement divergeraient, et c'est toujours celui qu'on ne
 * teste pas qui casse.
 *
 * Protection identique aux crons (`/api/cron/abonnements`) :
 * `Authorization: Bearer $ADMIN_SECRET`. Sans secret configuré, la route refuse
 * de s'exécuter plutôt que de s'ouvrir — elle peut offrir un an d'abonnement.
 * Ce secret n'est PAS le CRON_SECRET : un secret déposé chez Vercel pour
 * déclencher des tâches n'a pas à ouvrir l'encaissement.
 */
function autorise(request: NextRequest): Response | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return new Response("ADMIN_SECRET non configuré", { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorisé", { status: 401 });
  }
  return null;
}

/** Les déclarations en attente de vérification. */
export async function GET(request: NextRequest) {
  const refus = autorise(request);
  if (refus) return refus;

  const enAttente = await paiementsAVerifier();

  return Response.json({
    nombre: enAttente.length,
    paiements: enAttente.map((paiement) => ({
      reference: paiement.reference,
      entreprise: paiement.organization.name,
      plan: paiement.plan,
      cycle: paiement.billingCycle,
      montant: paiement.amount,
      transactionId: paiement.providerTransactionId,
      declareLe: paiement.updatedAt.toISOString(),
    })),
  });
}

/** Valide (encaisse) ou rejette une déclaration. */
export async function POST(request: NextRequest) {
  const refus = autorise(request);
  if (refus) return refus;

  let corps: {
    reference?: string;
    action?: string;
    montantRecu?: number;
  };
  try {
    corps = await request.json();
  } catch {
    return new Response("Corps illisible", { status: 400 });
  }

  if (!corps.reference) {
    return Response.json({ erreur: "reference manquante" }, { status: 400 });
  }

  if (corps.action === "rejeter") {
    const count = await echouerPaiement(corps.reference);
    return Response.json({
      resultat: count === 0 ? "aucun-paiement-en-attente" : "rejete",
    });
  }

  if (corps.action !== "valider") {
    return Response.json(
      { erreur: "action attendue : valider | rejeter" },
      { status: 400 },
    );
  }

  const resultat = await encaisserPaiement({
    reference: corps.reference,
    montantRecu: corps.montantRecu,
  });

  // Un montant incohérent n'est pas une panne : c'est une réponse à lire.
  // Le statut HTTP reste 200, le script affiche l'écart.
  return Response.json({ resultat });
}
