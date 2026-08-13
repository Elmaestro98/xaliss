"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { retirerMembre } from "@/app/(app)/equipe/actions";

/**
 * Retirer un membre de l'entreprise. Geste conséquent → une confirmation avant
 * d'envoyer. Ses dépenses déjà saisies restent au journal (aucune relation ne
 * les rattache à l'adhésion : createdById n'est qu'un identifiant Clerk).
 */
export function BoutonRetirerMembre({
  userId,
  nom,
}: {
  userId: string;
  nom: string;
}) {
  return (
    <form
      action={retirerMembre.bind(null, userId)}
      onSubmit={(evenement) => {
        if (
          !confirm(
            `Retirer ${nom} de l'entreprise ? Ses dépenses déjà enregistrées sont conservées.`,
          )
        ) {
          evenement.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        size="icon"
        variant="ghost"
        aria-label={`Retirer ${nom}`}
        className="text-muted-foreground hover:text-brique"
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </form>
  );
}
