import "server-only";

import { prisma } from "@/lib/prisma";

/** Délai de grâce avant effacement définitif — cohérent avec PROJET.md §10. */
export const JOURS_DE_GRACE = 30;

/**
 * Efface définitivement les entreprises supprimées depuis plus de 30 jours.
 *
 * La suppression en cascade emporte tout ce qui s'y rattache (dépenses,
 * justificatifs, budgets, notes de frais, journal d'audit) : c'est le droit à
 * la suppression de la loi 2008-12, appliqué une fois le délai écoulé.
 */
export async function purgerOrganisationsExpirees() {
  const limite = new Date();
  limite.setDate(limite.getDate() - JOURS_DE_GRACE);

  const expirees = await prisma.organization.findMany({
    where: { deletedAt: { not: null, lt: limite } },
    select: { id: true, name: true },
  });

  for (const org of expirees) {
    await prisma.organization.delete({ where: { id: org.id } });
  }

  return expirees;
}
