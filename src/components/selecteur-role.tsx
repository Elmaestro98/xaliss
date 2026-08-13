"use client";

import { changerRole } from "@/app/(app)/equipe/actions";

const OPTIONS = [
  { valeur: "ADMIN", libelle: "Gérant" },
  { valeur: "COMPTABLE", libelle: "Comptable" },
  { valeur: "EMPLOYE", libelle: "Employé" },
] as const;

/**
 * Le rôle d'un membre. Un <select> natif qui se soumet dès qu'on change de
 * valeur — pas de bouton « Enregistrer » à chercher (même geste que le
 * sélecteur de période des Rapports). L'action est liée à l'identifiant du
 * membre concerné.
 */
export function SelecteurRole({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) {
  return (
    <form action={changerRole.bind(null, userId)}>
      <select
        name="role"
        defaultValue={role}
        aria-label="Rôle du membre"
        onChange={(evenement) => evenement.currentTarget.form?.requestSubmit()}
        className="h-9 cursor-pointer rounded-sm border border-reglure bg-card px-2 text-sm focus-visible:border-indigo focus-visible:outline-none"
      >
        {OPTIONS.map((option) => (
          <option key={option.valeur} value={option.valeur}>
            {option.libelle}
          </option>
        ))}
      </select>
    </form>
  );
}
