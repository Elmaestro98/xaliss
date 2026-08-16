import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { estEditeur } from "@/lib/editeur";

export const dynamic = "force-dynamic";

/**
 * L'aiguillage d'après-connexion.
 *
 * Clerk ne sait pas distinguer un gérant de PME de l'éditeur de Xaalis : il
 * renvoie tout le monde à la même adresse. Cette page fait le tri une fois,
 * puis s'efface — elle ne rend rien, elle redirige.
 *
 * L'éditeur atterrit sur sa console, les clients sur leur tableau de bord.
 * Volontairement une redirection et non un blocage : Med Cheikh est aussi
 * gérant de sa propre entreprise, et `/dashboard` lui reste ouvert s'il y va
 * lui-même. Interdire l'application à l'éditeur reviendrait à l'empêcher
 * d'utiliser le produit qu'il vend.
 */
export default async function ApresConnexion() {
  const { userId } = await auth();

  if (!userId) redirect("/sign-in");
  if (await estEditeur(userId)) redirect("/editeur");

  redirect("/dashboard");
}
