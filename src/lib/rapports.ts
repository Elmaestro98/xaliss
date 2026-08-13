import "server-only";

export type PeriodeMois = { debut: Date; fin: Date; param: string };

/**
 * Parse un paramètre d'URL "AAAA-MM" (mois courant par défaut, ou si invalide)
 * en bornes de mois civil. `fin` est exclusive (`lt`), comme partout ailleurs
 * dans le projet (voir lib/periode.ts).
 */
export function resoudrePeriodeMois(mois: string | undefined): PeriodeMois {
  const maintenant = new Date();
  const [anneeBrute, moisBrut] = (mois ?? "").split("-").map(Number);
  const valide =
    Number.isInteger(anneeBrute) &&
    Number.isInteger(moisBrut) &&
    moisBrut >= 1 &&
    moisBrut <= 12;

  const annee = valide ? anneeBrute : maintenant.getFullYear();
  const moisIndex = valide ? moisBrut - 1 : maintenant.getMonth();

  const debut = new Date(annee, moisIndex, 1);
  const fin = new Date(annee, moisIndex + 1, 1);
  const param = `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, "0")}`;

  return { debut, fin, param };
}
