/**
 * Les messages de confirmation, et leurs clés.
 *
 * ⚠️ C'est une CLÉ qui voyage dans l'URL (`?ok=depense-creee`), jamais le
 * texte. La différence n'est pas cosmétique : une URL se fabrique à la main.
 * Si le message y transitait en clair, n'importe qui pourrait envoyer un lien
 * affichant « Paiement encaissé, abonnement activé » à un client qui n'a rien
 * payé. Une clé inconnue n'affiche rien du tout.
 *
 * Le texte est donc écrit ici, côté application, et la clé n'est qu'un
 * jeton sans pouvoir.
 */
export const MESSAGES_SUCCES = {
  "depense-creee": "Dépense enregistrée.",
  "depense-modifiee": "Dépense modifiée.",
  "depense-supprimee": "Dépense supprimée.",

  "budget-cree": "Budget créé.",
  "budget-supprime": "Budget supprimé.",

  "recurrence-creee": "Dépense récurrente créée.",
  "recurrence-supprimee": "Récurrence supprimée.",

  "note-creee": "Note de frais créée.",
  "note-soumise": "Note soumise pour validation.",
  "note-approuvee": "Note approuvée.",
  "note-rejetee": "Note rejetée.",
  "note-remboursee": "Note marquée comme remboursée.",
  "note-corrigee": "Note remise en brouillon.",

  "categorie-creee": "Catégorie créée.",
  "categorie-modifiee": "Catégorie modifiée.",

  "membre-retire": "Membre retiré de l'entreprise.",
  "role-modifie": "Rôle modifié.",

  "paiement-declare": "Déclaration enregistrée. Nous vérifions le versement.",
  "paiement-encaisse": "Paiement encaissé. L'abonnement est actif.",
  "paiement-rejete": "Déclaration rejetée.",
} as const;

export type CleSucces = keyof typeof MESSAGES_SUCCES;

/**
 * Ajoute la confirmation à une destination de redirection.
 *
 * Passe par `URLSearchParams` plutôt que par une concaténation : la moitié de
 * ces chemins portent déjà des paramètres (filtres du journal, cycle de
 * facturation), et un second `?` les effacerait.
 */
export function avecSucces(chemin: string, cle: CleSucces): string {
  const [base, requete] = chemin.split("?");
  const parametres = new URLSearchParams(requete);
  parametres.set("ok", cle);
  return `${base}?${parametres.toString()}`;
}
