import { Role } from "@/generated/prisma/enums";

/**
 * Matrice des permissions — PROJET.md section 5.
 *
 * Ces verifications sont la seule autorite : elles s'executent cote serveur.
 * L'interface peut masquer un bouton, jamais autoriser une action.
 */
export const PERMISSIONS = [
  "expenses:read:all", // voir les depenses de toute l'entreprise
  "expenses:read:own", // voir uniquement ses propres depenses
  "expenses:write", // creer / modifier une depense directement
  "categories:manage",
  "budgets:manage",
  "reports:submit", // soumettre une note de frais
  "reports:approve", // approuver ou rejeter
  "reports:reimburse", // marquer comme remboursee
  "exports:generate",
  "members:manage",
  "subscription:manage",
  "dashboard:full", // dashboard entreprise (sinon : vue personnelle)
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.ADMIN]: PERMISSIONS,
  [Role.COMPTABLE]: [
    "expenses:read:all",
    "expenses:read:own",
    "expenses:write",
    "categories:manage",
    "budgets:manage",
    "reports:submit",
    "reports:reimburse",
    "exports:generate",
    "dashboard:full",
  ],
  [Role.EMPLOYE]: ["expenses:read:own", "reports:submit"],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Permission refusée : ${permission}`);
    this.name = "ForbiddenError";
  }
}

/** Leve une ForbiddenError si le role ne detient pas la permission. */
export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError(permission);
  }
}
