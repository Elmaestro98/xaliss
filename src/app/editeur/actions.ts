"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { requireEditeur } from "@/lib/editeur";
import { echouerPaiement, encaisserPaiement } from "@/lib/facturation";
import { formatFCFA } from "@/lib/format";

export type EtatEncaissement = {
  message?: string;
  ton?: "vert" | "brique";
};

/**
 * Le montant réellement constaté sur Wave Business.
 *
 * Obligatoire, et jamais prérempli avec le montant attendu : c'est tout
 * l'intérêt du champ. Le préremplir transformerait la confrontation en un
 * clic, et un clic ne vérifie rien. L'éditeur doit lire la somme sur son
 * portefeuille marchand et la retaper.
 */
const SchemaMontant = z.object({
  montantRecu: z.coerce
    .number({ message: "Saisissez le montant constaté sur Wave." })
    .int("Le montant est un entier de francs CFA, sans décimales.")
    .positive("Le montant doit être supérieur à zéro."),
});

/**
 * Encaisse un paiement déclaré, depuis la console.
 *
 * ⚠️ Ceci est le second chemin d'encaissement, à côté de
 * `scripts/valider-paiement.ts`. Il a été ouvert sciemment (voir PROJET.md
 * §7) : la protection n'est plus « aucune requête web ne mène ici » mais
 * « une session Clerk dont l'identifiant figure dans SUPER_ADMIN_USER_IDS ».
 *
 * Deux précautions rendent ce chemin tenable :
 *  - il appelle la MÊME fonction `encaisserPaiement()` que le script, donc il
 *    n'existe toujours qu'une seule implémentation de l'activation ;
 *  - il enregistre QUI a validé dans l'AuditLog, ce que la ligne de commande
 *    ne pouvait pas faire. On perd une barrière, on gagne une trace.
 */
export async function validerEncaissement(
  reference: string,
  _etat: EtatEncaissement,
  formData: FormData,
): Promise<EtatEncaissement> {
  // En premier, toujours : une action serveur est une route publique tant
  // qu'elle ne s'est pas gardée elle-même.
  const editeur = await requireEditeur();

  const saisie = SchemaMontant.safeParse({
    montantRecu: formData.get("montantRecu"),
  });
  if (!saisie.success) {
    return {
      ton: "brique",
      message: saisie.error.issues[0]?.message ?? "Montant invalide.",
    };
  }

  const resultat = await encaisserPaiement({
    reference,
    montantRecu: saisie.data.montantRecu,
    actorId: `editeur:${editeur}`,
  });

  revalidatePath("/editeur");

  switch (resultat.type) {
    case "encaisse":
      return { ton: "vert", message: "Encaissé. L'abonnement est actif." };
    case "deja-traite":
      return { ton: "vert", message: "Ce paiement était déjà encaissé." };
    case "introuvable":
      return { ton: "brique", message: "Référence introuvable." };
    case "montant-incoherent":
      return {
        ton: "brique",
        message:
          `Écart de montant : ${formatFCFA(resultat.recu)} constatés pour ` +
          `${formatFCFA(resultat.attendu)} attendus. Le paiement est marqué ` +
          `en échec, l'abonnement n'a pas été activé.`,
      };
  }
}

/** Rejette une déclaration : le client a annoncé un paiement qu'on ne trouve pas. */
export async function rejeterDeclaration(
  reference: string,
  _etat: EtatEncaissement,
  _formData: FormData,
): Promise<EtatEncaissement> {
  await requireEditeur();

  const touches = await echouerPaiement(reference);
  revalidatePath("/editeur");

  return touches === 0
    ? { ton: "brique", message: "Aucune déclaration en attente sous cette référence." }
    : { ton: "vert", message: "Déclaration rejetée." };
}
