import type { BudgetPeriod } from "@/generated/prisma/enums";

export type Periode = { debut: Date; fin: Date };

/**
 * La fenêtre courante d'un budget : le mois civil ou le trimestre civil en
 * cours (PROJET.md §4.2). Un budget trimestriel consulté le 19 juillet couvre
 * donc du 1er juillet à maintenant — les trimestres sont calés sur le
 * calendrier (janv-mars, avr-juin, juil-sept, oct-déc), comme en comptabilité.
 */
export function periodeBudget(
  period: BudgetPeriod,
  maintenant = new Date(),
): Periode {
  if (period === "QUARTERLY") {
    const moisDebutTrimestre = Math.floor(maintenant.getMonth() / 3) * 3;
    return {
      debut: new Date(maintenant.getFullYear(), moisDebutTrimestre, 1),
      fin: maintenant,
    };
  }
  return periodeCourante(maintenant);
}

/** Du 1er du mois à maintenant. */
export function periodeCourante(maintenant = new Date()): Periode {
  return {
    debut: new Date(maintenant.getFullYear(), maintenant.getMonth(), 1),
    fin: maintenant,
  };
}

/**
 * La MÊME tranche de jours, le mois précédent — pas le mois précédent entier.
 * Comparer 6 jours écoulés à 31 jours complets ferait paraître chaque début de
 * mois comme un effondrement des dépenses. Le jour est borné au dernier jour du
 * mois précédent (un 31 mars se compare au 28 février).
 */
export function periodeEquivalenteMoisPrecedent(
  maintenant = new Date(),
): Periode {
  const debut = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
  const joursDansMoisPrecedent = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    0,
  ).getDate();
  const jour = Math.min(maintenant.getDate(), joursDansMoisPrecedent);

  return {
    debut,
    fin: new Date(
      debut.getFullYear(),
      debut.getMonth(),
      jour,
      maintenant.getHours(),
      maintenant.getMinutes(),
      maintenant.getSeconds(),
    ),
  };
}

/** Variation en pourcentage, ou null si le mois précédent était à zéro. */
export function evolution(courant: number, precedent: number): number | null {
  if (precedent === 0) return null;
  return Math.round(((courant - precedent) / precedent) * 100);
}

/**
 * Les `nombre` derniers mois civils, du plus ancien au plus récent (mois
 * courant inclus). Chaque mois est une fenêtre [debut, finExclusive[ : le mois
 * courant s'arrête donc de lui-même à aujourd'hui, aucune dépense n'étant
 * future. Le libellé court (« janv », « févr »…) sert d'axe au graphique.
 */
export function derniersMois(
  nombre: number,
  maintenant = new Date(),
): { debut: Date; finExclusive: Date; label: string }[] {
  const mois: { debut: Date; finExclusive: Date; label: string }[] = [];
  for (let i = nombre - 1; i >= 0; i--) {
    const debut = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth() - i,
      1,
    );
    const finExclusive = new Date(debut.getFullYear(), debut.getMonth() + 1, 1);
    const label = new Intl.DateTimeFormat("fr-SN", { month: "short" })
      .format(debut)
      .replace(".", "");
    mois.push({ debut, finExclusive, label });
  }
  return mois;
}
