"use client";

import { Input } from "@/components/ui/input";

/**
 * Le sélecteur de mois de la page Rapports. Changer de mois resoumet le
 * formulaire vers la page elle-même (action GET par défaut) pour rafraîchir
 * les aperçus — les boutons d'export, eux, portent leur propre formAction et
 * ne sont pas concernés par cette resoumission.
 */
export function SelecteurPeriode({ defaultValue }: { defaultValue: string }) {
  return (
    <Input
      id="mois"
      name="mois"
      type="month"
      defaultValue={defaultValue}
      aria-label="Mois à exporter"
      onChange={(evenement) => evenement.currentTarget.form?.requestSubmit()}
      className="h-9 w-40 border-reglure bg-card"
    />
  );
}
