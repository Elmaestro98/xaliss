import "server-only";

import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

/**
 * L'éditeur — AFRICATECHNOLOGIE / E-DEV, pas un client.
 *
 * Volontairement PAS un rôle en base. `Membership.role` répond à la question
 * « que peut cette personne DANS son entreprise ? » ; l'éditeur, lui, n'est
 * dans aucune entreprise, il les regarde toutes. Ajouter un quatrième rôle
 * mélangerait deux questions et donnerait à la matrice de permissions
 * (PROJET.md §5) un cas qui n'a rien à y faire.
 *
 * La liste vit donc dans l'environnement, comme ADMIN_SECRET : une donnée de
 * déploiement, pas une donnée métier. La modifier demande un accès au serveur,
 * pas un clic dans l'application — et aucune requête ne peut s'y ajouter.
 */
function identifiantsAutorises(): string[] {
  return (process.env.SUPER_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((identifiant) => identifiant.trim())
    .filter(Boolean);
}

/**
 * Sans effet de bord — pour orienter, pas pour protéger.
 *
 * Sert à envoyer l'éditeur vers sa console après connexion. Une garde, elle,
 * doit interrompre : c'est `requireEditeur()`. Ne jamais utiliser celle-ci
 * pour décider d'afficher ou non des données.
 */
export async function estEditeur(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  return identifiantsAutorises().includes(userId);
}

/**
 * Garde de la console éditeur.
 *
 * 404 et non 403, comme partout ailleurs dans Xaalis : un 403 confirmerait à
 * un curieux que l'adresse existe. Variable absente ou vide = personne n'entre.
 * On ferme par défaut ; une console qui s'ouvrirait faute de configuration
 * serait exactement la mauvaise façon de se tromper.
 */
export async function requireEditeur(): Promise<string> {
  // `auth()` est appelé AVANT de regarder la liste, et l'ordre compte.
  // C'est une API de requête : y toucher signale à Next.js que la page dépend
  // de la requête en cours. Tester la liste d'abord ferait sortir la fonction
  // par `notFound()` sans jamais l'appeler quand la variable est absente — la
  // page serait alors préconstruite en 404 au build, et resterait introuvable
  // en production même une fois la variable renseignée.
  const { userId } = await auth();

  const autorises = identifiantsAutorises();
  if (autorises.length === 0) notFound();
  if (!userId || !autorises.includes(userId)) notFound();

  return userId;
}
