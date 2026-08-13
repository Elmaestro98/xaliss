"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { creerNote, type EtatFormulaire } from "@/app/(app)/notes-de-frais/actions";

function Erreur({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-brique">
      {messages[0]}
    </p>
  );
}

export function FormulaireNote() {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(
    creerNote,
    {},
  );

  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="note-title">Titre de la note</Label>
        <Input
          id="note-title"
          name="title"
          required
          placeholder="Mission Thiès, avril 2026…"
          className="mt-1.5"
        />
        <Erreur messages={etat.erreurs?.title} />
      </div>

      {etat.message && (
        <p role="alert" className="text-sm text-brique">
          {etat.message}
        </p>
      )}

      <Button type="submit" disabled={enCours}>
        {enCours ? "Création…" : "Créer la note"}
      </Button>
    </form>
  );
}
