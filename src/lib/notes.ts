import { ReportStatus } from "@/generated/prisma/enums";
import type { Ton } from "@/components/pastille-statut";

/** Libellés et couleurs partagés entre la liste et le détail d'une note. */
export const LIBELLE_STATUT_NOTE: Record<ReportStatus, string> = {
  BROUILLON: "Brouillon",
  SOUMISE: "Soumise",
  APPROUVEE: "Approuvée",
  REJETEE: "Rejetée",
  REMBOURSEE: "Remboursée",
};

/**
 * Le ton de chaque étape du workflow (PROJET.md §8), dans le vocabulaire des
 * cinq tons de Xaalis — voir `components/pastille-statut.tsx`.
 *
 * APPROUVEE est en ocre et non en vert : approuvée n'est pas remboursée.
 * L'employé attend encore son argent, et une pastille verte lui ferait croire
 * que l'affaire est close. Le vert est réservé à REMBOURSEE, seul état où
 * plus personne ne doit rien.
 */
export const TON_STATUT_NOTE: Record<ReportStatus, Ton> = {
  BROUILLON: "neutre",
  SOUMISE: "indigo",
  APPROUVEE: "ocre",
  REJETEE: "brique",
  REMBOURSEE: "vert",
};
