"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  creerCategorie,
  type EtatFormulaire,
} from "@/app/(app)/parametres/actions";

function Erreur({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="mt-1 text-sm text-brique">
      {messages[0]}
    </p>
  );
}

export function FormulaireCategorie() {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(
    creerCategorie,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const dejaEnvoye = useRef(false);

  // À la fin d'un envoi sans erreur, on vide le formulaire : les champs non
  // contrôlés reprennent leur valeur par défaut (couleur indigo, texte vide).
  useEffect(() => {
    if (enCours) {
      dejaEnvoye.current = true;
    } else if (dejaEnvoye.current && !etat.erreurs && !etat.message) {
      dejaEnvoye.current = false;
      formRef.current?.reset();
    }
  }, [enCours, etat]);

  return (
    <form
      ref={formRef}
      action={action}
      className="mt-4 rounded-xl border border-reglure bg-card px-4 py-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="cat-color" className="text-xs text-muted-foreground">
            Couleur
          </Label>
          <input
            id="cat-color"
            type="color"
            name="color"
            defaultValue="#2b3a8f"
            aria-label="Couleur de la catégorie"
            className="mt-1.5 block size-9 cursor-pointer rounded-[3px] rounded-xl border border-reglure bg-card p-0.5"
          />
        </div>

        <div className="min-w-40 flex-1">
          <Label htmlFor="cat-name" className="text-xs text-muted-foreground">
            Nom de la catégorie
          </Label>
          <Input
            id="cat-name"
            name="name"
            required
            maxLength={60}
            placeholder="Ex. Frais de mission"
            className="mt-1.5 h-9 border-reglure bg-card"
          />
        </div>

        <div className="w-28">
          <Label htmlFor="cat-code" className="text-xs text-muted-foreground">
            Code
          </Label>
          <Input
            id="cat-code"
            name="codeSyscohada"
            inputMode="numeric"
            placeholder="601"
            aria-label="Code SYSCOHADA (facultatif)"
            className="code-compte mt-1.5 h-9 border-reglure bg-card"
          />
        </div>

        <Button type="submit" disabled={enCours} className="h-9">
          <Plus className="size-4" aria-hidden />
          {enCours ? "Ajout…" : "Ajouter"}
        </Button>
      </div>

      <Erreur messages={etat.erreurs?.name} />
      <Erreur messages={etat.erreurs?.codeSyscohada} />
      <Erreur messages={etat.erreurs?.color} />
    </form>
  );
}
