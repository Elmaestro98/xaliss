"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supprimerDepense } from "@/app/(app)/depenses/actions";
import { formatFCFA } from "@/lib/format";

/**
 * Supprimer une ligne du journal. Le geste est définitif côté comptable — la
 * confirmation rappelle donc le montant, pas seulement « êtes-vous sûr ? » :
 * c'est le montant qui permet de reconnaître la bonne ligne.
 *
 * Le contenu supprimé reste dans AuditLog (PROJET.md §10).
 */
export function BoutonSupprimerDepense({
  id,
  montant,
  libelle,
}: {
  id: string;
  montant: number;
  libelle: string;
}) {
  return (
    <form
      action={supprimerDepense.bind(null, id)}
      onSubmit={(evenement) => {
        if (
          !confirm(
            `Supprimer définitivement « ${libelle} » — ${formatFCFA(montant)} ?\n\nLe justificatif joint sera effacé avec elle.`,
          )
        ) {
          evenement.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        className="text-muted-foreground hover:bg-brique/10 hover:text-brique"
      >
        <Trash2 className="size-4" aria-hidden />
        Supprimer
      </Button>
    </form>
  );
}
