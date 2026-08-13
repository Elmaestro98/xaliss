import "server-only";

import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { synchroniserAdhesion, synchroniserOrganisation } from "@/lib/sync-clerk";

export type Session = {
  userId: string;
  organizationId: string;
  organizationName: string;
  role: Role;
};

/**
 * Trois situations, pas deux.
 *
 * Les confondre coûte cher : renvoyer vers /sign-in une entreprise supprimée
 * dont la session Clerk est toujours active provoque une boucle infinie —
 * /sign-in voit une session valide et renvoie aussitôt vers /dashboard.
 */
type Resolution =
  | { type: "ok"; session: Session }
  | { type: "anonyme" } // non connecté, ou aucune entreprise active
  | { type: "supprimee"; nom: string; purgeLe: Date };

/**
 * Filet de sécurité : crée l'entreprise et l'adhésion à la première visite si
 * le webhook Clerk ne l'a pas déjà fait (webhook perdu, ou développement local
 * sans tunnel public). Voir lib/sync-clerk.ts.
 */
async function synchroniserDepuisClerk(
  userId: string,
  organizationId: string,
  clerkOrgRole: string | null | undefined,
): Promise<Session> {
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId });

  await synchroniserOrganisation({
    id: organizationId,
    name: org.name,
    logo: org.imageUrl,
  });
  const adhesion = await synchroniserAdhesion({
    userId,
    organizationId,
    clerkOrgRole,
  });

  return {
    userId,
    organizationId,
    organizationName: adhesion.organization.name,
    role: adhesion.role,
  };
}

const JOURS_DE_GRACE = 30;

const resoudreSession = cache(async (): Promise<Resolution> => {
  const { userId, orgId, orgRole } = await auth();
  if (!userId || !orgId) return { type: "anonyme" };

  const adhesion = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: orgId } },
    include: { organization: { select: { name: true, deletedAt: true } } },
  });

  if (adhesion) {
    if (adhesion.organization.deletedAt) {
      const purgeLe = new Date(adhesion.organization.deletedAt);
      purgeLe.setDate(purgeLe.getDate() + JOURS_DE_GRACE);
      return { type: "supprimee", nom: adhesion.organization.name, purgeLe };
    }

    return {
      type: "ok",
      session: {
        userId,
        organizationId: orgId,
        organizationName: adhesion.organization.name,
        role: adhesion.role,
      },
    };
  }

  return {
    type: "ok",
    session: await synchroniserDepuisClerk(userId, orgId, orgRole),
  };
});

/** Session courante, ou null. Mémoïsée pour la durée du rendu. */
export async function getSession(): Promise<Session | null> {
  const resolution = await resoudreSession();
  return resolution.type === "ok" ? resolution.session : null;
}

/** L'entreprise supprimée, pour la page qui l'annonce. */
export async function getOrganisationSupprimee() {
  const resolution = await resoudreSession();
  return resolution.type === "supprimee" ? resolution : null;
}

/**
 * Session garantie : à appeler dans toute page qui lit des données
 * d'entreprise. C'est ici que se joue la protection des routes, pas dans le
 * middleware.
 *
 * Chaque situation a sa sortie. « anonyme » va vers /sign-in, où <SignIn />
 * affiche de lui-même l'étape de choix / création d'entreprise si la session
 * Clerk est « pending ». « supprimee » a sa propre page : l'envoyer vers
 * /sign-in bouclerait à l'infini.
 */
export async function requireSession(): Promise<Session> {
  const resolution = await resoudreSession();
  if (resolution.type === "supprimee") redirect("/entreprise-supprimee");
  if (resolution.type === "anonyme") redirect("/sign-in");
  return resolution.session;
}
