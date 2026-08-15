import "server-only";

/**
 * Lien de paiement Wave — PROJET.md §9.
 *
 * Xaalis n'appelle pas l'API Wave : l'entreprise paie sur un lien de paiement
 * du portefeuille marchand, puis déclare son versement. Un lien statique ne
 * transporte aucune référence — Wave ne peut donc pas dire à Xaalis *qui* vient
 * de payer *quoi*. C'est le prix de ce choix, et il gouverne tout le reste :
 * l'encaissement est un geste humain, pas un webhook.
 *
 * À ne pas confondre avec `lib/paiement.ts`, qui décrit comment une PME règle
 * ses fournisseurs. Ici il s'agit de ce que la PME paie à Xaalis.
 */

/**
 * Le lien du portefeuille marchand, à montant libre : le client saisit
 * lui-même la somme, que Xaalis lui dicte à l'écran depuis `lib/plans.ts`.
 *
 * En variable d'environnement plutôt qu'en dur : le lien de préproduction et
 * celui de production diffèrent, et un lien de paiement n'a rien à faire dans
 * l'historique Git.
 */
export const LIEN_WAVE = process.env.WAVE_PAYMENT_LINK?.trim() || null;

/**
 * Distingue « Wave est branché » de « rien n'est configuré ».
 *
 * Sans lien, la souscription doit échouer franchement plutôt que d'envoyer le
 * gérant vers une page vide : il n'existe plus de mode simulation pour rattraper
 * une configuration absente.
 */
export const paiementConfigure = LIEN_WAVE !== null;

export class PaiementNonConfigureError extends Error {
  constructor() {
    super(
      "Le paiement n'est pas configuré (WAVE_PAYMENT_LINK manquante). Contactez le support.",
    );
    this.name = "PaiementNonConfigureError";
  }
}

/** Le lien vers lequel envoyer le client, ou une erreur explicite. */
export function lienPaiement(): string {
  if (!LIEN_WAVE) throw new PaiementNonConfigureError();
  return LIEN_WAVE;
}
