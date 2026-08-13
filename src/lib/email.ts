import "server-only";

import { Resend } from "resend";

/**
 * Envoi d'emails transactionnels via Resend — PROJET.md §6 et §9.
 *
 * L'email est un confort, jamais un point de blocage : sans clé configurée,
 * on trace et on continue — une dépense ne doit pas échouer parce que le
 * courrier ne part pas. Les échecs d'envoi sont notés, pas relancés (v1).
 *
 * En mode test (domaine non vérifié), Resend ne délivre qu'à l'adresse du
 * compte Resend lui-même — suffisant pour le développement.
 */

// Adresse de test Resend ; à remplacer par une adresse @xaalis.sn une fois
// le domaine vérifié en production.
const EXPEDITEUR = "Xaalis <onboarding@resend.dev>";

export async function envoyerEmail(params: {
  destinataires: string[];
  sujet: string;
  html: string;
}): Promise<void> {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    console.warn("[email] RESEND_API_KEY absente — email non envoyé :", params.sujet);
    return;
  }
  if (params.destinataires.length === 0) return;

  // En mode test Resend (domaine non vérifié), tout part vers la boîte du
  // compte Resend : cette variable la désigne. À RETIRER en production —
  // sinon tous les clients écriraient dans une seule boîte.
  const detournement = process.env.EMAIL_TEST_DESTINATAIRE;
  const destinataires = detournement ? [detournement] : params.destinataires;

  const resend = new Resend(cle);
  const { error } = await resend.emails.send({
    from: EXPEDITEUR,
    to: destinataires,
    subject: params.sujet,
    html: params.html,
  });

  if (error) {
    console.warn("[email] Envoi échoué :", error.message);
  }
}
