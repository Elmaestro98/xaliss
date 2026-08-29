import "server-only";

import { prismaHorsPortee, prismaPourOrg } from "@/lib/prisma";

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

  // Hors portée, par nature : la purge cherche les entreprises à effacer, elle
  // ne travaille pas POUR une entreprise. Aucun `organizationId` ne pourrait
  // la restreindre — c'est justement toutes les entreprises qu'elle balaie.
  const expirees = await prismaHorsPortee.organization.findMany({
    where: { deletedAt: { not: null, lt: limite } },
    select: { id: true, name: true },
  });

  for (const org of expirees) {
    // Portée sur l'entreprise qu'on efface, une par une : la recherche est
    // transverse, l'effacement ne l'est pas. Les lignes filles partent en
    // cascade — PostgreSQL exécute l'intégrité référentielle sans repasser par
    // les policies, il n'y a donc rien de plus à porter.
    await prismaPourOrg(org.id).organization.delete({ where: { id: org.id } });
  }

  return expirees;
}
