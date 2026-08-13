"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rejeterNote, type EtatFormulaire } from "@/app/(app)/notes-de-frais/actions";

export function FormulaireRejet({ reportId }: { reportId: string }) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(
    rejeterNote.bind(null, reportId),
    {},
  );

  return (
    <form action={action} className="space-y-2">
      <Label htmlFor="motif" className="text-brique">
        Motif du rejet
      </Label>
      <Textarea
        id="motif"
        name="motif"
        required
        placeholder="Justificatif illisible, dépense hors politique…"
      />
      {etat.erreurs?.motif && (
        <p role="alert" className="text-sm text-brique">
          {etat.erreurs.motif[0]}
        </p>
      )}
      <Button type="submit" variant="destructive" disabled={enCours}>
        {enCours ? "Rejet…" : "Rejeter la note"}
      </Button>
    </form>
  );
}
