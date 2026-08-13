/**
 * Les montants sont stockés en entiers (FCFA sans décimales) — PROJET.md §6.
 * Le franc CFA n'a pas de subdivision en usage : aucun arrondi à gérer.
 */

/** `1250000` -> `"1 250 000 FCFA"` (espace insécable étroite, usage français). */
export function formatFCFA(montant: number): string {
  return `${formatNombre(montant)} FCFA`;
}

/** Le nombre seul, pour composer soi-même l'unité (chiffre monumental + label). */
export function formatNombre(montant: number): string {
  return new Intl.NumberFormat("fr-SN").format(montant);
}

/** `"15 mars 2026"` */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-SN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** `"mars 2026"` — en-tête de période. */
export function formatMois(date: Date): string {
  return new Intl.DateTimeFormat("fr-SN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Intl rend les mois en minuscules en français ; les titres les veulent capitalisés. */
export function capitaliser(texte: string): string {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
