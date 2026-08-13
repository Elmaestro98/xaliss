import "server-only";

/**
 * Réglages d'entreprise stockés dans Organization.settings (Json).
 *
 * Seuils d'alerte budget (PROJET.md §4.5) : un budget alerte au franchissement
 * du seuil précoce (configurable, défaut 80 %) PUIS à 100 % (dépassement, fixe
 * par construction). On ne stocke donc que le seuil précoce ; le tableau
 * complet posé sur chaque Budget reste [seuil, 100] — la forme que lit
 * lib/alertes-budget.ts sans changer.
 */
export const SEUIL_ALERTE_DEFAUT = 80;
export const SEUIL_DEPASSEMENT = 100;

/** Lit le seuil d'alerte précoce depuis settings, avec repli sur le défaut. */
export function lireSeuilAlerte(settings: unknown): number {
  if (
    settings &&
    typeof settings === "object" &&
    "alertThresholds" in settings &&
    Array.isArray((settings as { alertThresholds: unknown }).alertThresholds)
  ) {
    const premier = (settings as { alertThresholds: unknown[] })
      .alertThresholds[0];
    if (typeof premier === "number" && premier >= 1 && premier < 100) {
      return premier;
    }
  }
  return SEUIL_ALERTE_DEFAUT;
}

/** Le tableau [seuil précoce, dépassement] à poser sur un Budget. */
export function seuilsDepuisAlerte(seuilAlerte: number): number[] {
  return [seuilAlerte, SEUIL_DEPASSEMENT];
}
