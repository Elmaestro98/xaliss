import { ReportStatus } from "@/generated/prisma/enums";

/** Libellés et couleurs partagés entre la liste et le détail d'une note. */
export const LIBELLE_STATUT_NOTE: Record<ReportStatus, string> = {
  BROUILLON: "Brouillon",
  SOUMISE: "Soumise",
  APPROUVEE: "Approuvée",
  REJETEE: "Rejetée",
  REMBOURSEE: "Remboursée",
};

/** Classe Tailwind de couleur de texte — même palette que les jauges de budget. */
export const COULEUR_STATUT_NOTE: Record<ReportStatus, string> = {
  BROUILLON: "text-muted-foreground",
  SOUMISE: "text-indigo",
  APPROUVEE: "text-ocre",
  REJETEE: "text-brique",
  REMBOURSEE: "text-vert",
};
