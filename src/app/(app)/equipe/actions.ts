"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import * as z from "zod";
import { Role } from "@/generated/prisma/enums";
import { assertCan } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { retirerAdhesion } from "@/lib/sync-clerk";

/**
 * Gestion de l'équipe (PROJET.md §4.5, §5, §6).
 *
 * Le rôle fait foi en base (Membership.role), pas chez Clerk : c'est ici qu'un
 * gérant le change. Le webhook « organizationMembership.updated » est d'ailleurs
 * ignoré exprès (voir api/webhooks/clerk) pour ne pas écraser ce choix.
 *
 * Anti-verrouillage : un gérant ne peut agir ni sur son propre rôle ni sur son
 * propre retrait. Comme seul un gérant atteint ces actions, l'acteur reste
 * toujours gérant — l'entreprise ne peut jamais se retrouver sans aucun gérant.
 */
export async function changerRole(
  userId: string,
  donnees: FormData,
): Promise<void> {
  const session = await requireSession();
  assertCan(session.role, "members:manage");
  if (userId === session.userId) return;

  const role = z.enum(Role).safeParse(donnees.get("role"));
  if (!role.success) return;

  // updateMany borné au tenant : un identifiant étranger ne modifie rien.
  const resultat = await prisma.membership.updateMany({
    where: { userId, organizationId: session.organizationId },
    data: { role: role.data },
  });

  if (resultat.count > 0) {
    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorId: session.userId,
        entity: "Membership",
        entityId: userId,
        action: "MODIFICATION",
        metadata: { role: role.data },
      },
    });
  }

  revalidatePath("/equipe");
}

export async function retirerMembre(userId: string): Promise<void> {
  const session = await requireSession();
  assertCan(session.role, "members:manage");
  if (userId === session.userId) return;

  // La cible doit bien appartenir à cette entreprise.
  const membre = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: session.organizationId,
      },
    },
    select: { userId: true },
  });
  if (!membre) return;

  // Clerk fait foi sur l'appartenance : on retire d'abord là-bas (ce qui
  // déclenchera aussi le webhook), puis on nettoie localement sans attendre —
  // en développement local, le webhook peut ne jamais arriver.
  const client = await clerkClient();
  await client.organizations.deleteOrganizationMembership({
    organizationId: session.organizationId,
    userId,
  });
  await retirerAdhesion({ userId, organizationId: session.organizationId });

  await prisma.auditLog.create({
    data: {
      organizationId: session.organizationId,
      actorId: session.userId,
      entity: "Membership",
      entityId: userId,
      action: "SUPPRESSION",
      metadata: {},
    },
  });

  revalidatePath("/equipe");
}
