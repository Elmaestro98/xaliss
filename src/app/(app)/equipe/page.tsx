import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { Role } from "@/generated/prisma/enums";
import { BoutonRetirerMembre } from "@/components/bouton-retirer-membre";
import { SelecteurRole } from "@/components/selecteur-role";
import { Badge } from "@/components/ui/badge";
import { ROLES } from "@/lib/paiement";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

// Gérants en tête, puis comptables, puis employés — l'ordre de responsabilité.
const RANG_ROLE: Record<Role, number> = {
  [Role.ADMIN]: 0,
  [Role.COMPTABLE]: 1,
  [Role.EMPLOYE]: 2,
};

/**
 * Gestion de l'équipe (PROJET.md §4.5). Réservée au gérant (`members:manage`),
 * la page se protège elle-même. Le rôle vient de notre base (source de vérité) ;
 * le nom et l'email vivent chez Clerk (Membership ne porte qu'un identifiant).
 */
export default async function EquipePage() {
  const session = await requireSession();

  if (!can(session.role, "members:manage")) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 md:px-8">
        <h1 className="titre text-2xl">Réservé au gérant</h1>
        <p className="mt-3 text-muted-foreground">
          La gestion de l&apos;équipe est réservée au gérant de
          l&apos;entreprise.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block text-sm text-indigo underline underline-offset-4"
        >
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  const adhesionsLocales = await prisma.membership.findMany({
    where: { organizationId: session.organizationId },
    select: { userId: true, role: true },
  });
  const roleParUtilisateur = new Map(
    adhesionsLocales.map((adhesion) => [adhesion.userId, adhesion.role]),
  );

  const client = await clerkClient();
  const { data: adhesionsClerk } =
    await client.organizations.getOrganizationMembershipList({
      organizationId: session.organizationId,
      limit: 100,
    });

  const membres = adhesionsClerk.flatMap((adhesion) => {
    const profil = adhesion.publicUserData;
    if (!profil?.userId) return [];
    const nom =
      [profil.firstName, profil.lastName].filter(Boolean).join(" ") ||
      profil.identifier;
    // Repli sur Employé si l'adhésion locale manque (retard de webhook) : le
    // rôle réel se posera à la prochaine connexion du membre (getSession).
    const role = roleParUtilisateur.get(profil.userId) ?? Role.EMPLOYE;
    return [
      {
        userId: profil.userId,
        nom,
        email: profil.identifier,
        role,
        estMoi: profil.userId === session.userId,
      },
    ];
  });

  membres.sort(
    (a, b) => RANG_ROLE[a.role] - RANG_ROLE[b.role] || a.nom.localeCompare(b.nom),
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="titre text-2xl md:text-3xl">Équipe</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Les membres de {session.organizationName} et leurs rôles
      </p>

      <ul className="mt-8 divide-y divide-reglure border border-reglure bg-card">
        {membres.map((membre) => (
          <li
            key={membre.userId}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
          >
            <span
              aria-hidden
              className="titre flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground"
            >
              {membre.nom.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {membre.nom}
                {membre.estMoi && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (vous)
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {membre.email}
              </p>
            </div>

            {membre.estMoi ? (
              // On ne modifie pas son propre rôle : garde-fou anti-verrouillage.
              <Badge variant="outline" className="shrink-0">
                {ROLES[membre.role]}
              </Badge>
            ) : (
              <div className="flex shrink-0 items-center gap-1">
                <SelecteurRole userId={membre.userId} role={membre.role} />
                <BoutonRetirerMembre userId={membre.userId} nom={membre.nom} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        Pour inviter un nouveau membre, ouvrez le menu de l&apos;entreprise en
        haut à gauche, puis « Gérer l&apos;organisation » → Membres. Il arrive
        comme Employé ; vous ajustez son rôle ici.
      </p>
    </div>
  );
}
