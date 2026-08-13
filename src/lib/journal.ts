import "server-only";

/**
 * Une dépense rattachée à une note de frais n'intègre le journal de
 * l'entreprise qu'au remboursement de la note (PROJET.md §4.3) : tant que
 * la note est en BROUILLON, SOUMISE, APPROUVEE ou REJETEE, sa dépense ne
 * doit compter ni dans les totaux du tableau de bord, ni dans les jauges de
 * budget, ni dans le journal listé — sinon une simple soumission gonflerait
 * les chiffres avant toute validation.
 *
 * Une dépense saisie directement (reportId nul) est déjà dans le journal.
 */
export function dansLeJournal() {
  return {
    OR: [{ reportId: null }, { report: { status: "REMBOURSEE" as const } }],
  };
}
