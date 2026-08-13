import "server-only";

import { Role } from "@/generated/prisma/enums";
import { DEFAULT_CATEGORIES } from "@/lib/categories";
import { prisma } from "@/lib/prisma";

/**
 * Miroir de Clerk dans notre base.
 *
 * Deux chemins y mènent et doivent produire exactement le même résultat :
 *  - le webhook (temps réel, mais suppose une URL publique atteignable) ;
 *  - la synchro à la volée de `getSession()` (filet de sécurité : un webhook
 *    perdu, ou le développement en local sans tunnel, ne doivent pas empêcher
 *    quelqu'un de travailler).
 *
 * D'où ce fichier : une seule définition de « créer une entreprise Xaalis ».
 */

/**
 * Le rôle Clerk ne sert qu'à l'amorçage : le créateur devient ADMIN, tout
 * invité arrive EMPLOYE. Ensuite c'est `Membership.role` qui fait foi et un
 * ADMIN le change depuis Xaalis (PROJET.md §6).
 */
export function roleAmorce(clerkOrgRole: string | null | undefined): Role {
  return clerkOrgRole === "org:admin" ? Role.ADMIN : Role.EMPLOYE;
}

export type InfosOrganisation = {
  id: string;
  name: string;
  logo?: string | null;
};

/**
 * Crée l'entreprise avec son référentiel SYSCOHADA, ou rafraîchit son nom et
 * son logo. Ressuscite une entreprise dans son délai de grâce : si Clerk la
 * connaît encore, c'est qu'elle n'a pas été supprimée.
 */
export async function synchroniserOrganisation(org: InfosOrganisation) {
  return prisma.organization.upsert({
    where: { id: org.id },
    create: {
      id: org.id,
      name: org.name,
      logo: org.logo ?? null,
      categories: {
        create: DEFAULT_CATEGORIES.map((c) => ({ ...c, isDefault: true })),
      },
    },
    update: { name: org.name, logo: org.logo ?? null, deletedAt: null },
  });
}

/**
 * Crée l'adhésion si elle manque. Le rôle n'est posé qu'à la création : le
 * mettre à jour écraserait, à chaque événement Clerk, un rôle changé depuis
 * Xaalis.
 */
export async function synchroniserAdhesion(params: {
  userId: string;
  organizationId: string;
  clerkOrgRole?: string | null;
}) {
  return prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: params.userId,
        organizationId: params.organizationId,
      },
    },
    create: {
      userId: params.userId,
      organizationId: params.organizationId,
      role: roleAmorce(params.clerkOrgRole),
    },
    update: {},
    include: { organization: { select: { name: true } } },
  });
}

/** Début du délai de grâce : l'entreprise devient aussitôt inaccessible. */
export async function marquerOrganisationSupprimee(organizationId: string) {
  return prisma.organization.updateMany({
    where: { id: organizationId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

export async function retirerAdhesion(params: {
  userId: string;
  organizationId: string;
}) {
  return prisma.membership.deleteMany({
    where: { userId: params.userId, organizationId: params.organizationId },
  });
}
