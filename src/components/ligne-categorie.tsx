"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  modifierCategorie,
  supprimerCategorie,
  type EtatFormulaire,
} from "@/app/(app)/parametres/actions";

type Categorie = {
  id: string;
  name: string;
  codeSyscohada: string | null;
  color: string | null;
  isDefault: boolean;
  nbUtilisations: number;
};

export function LigneCategorie({ categorie }: { categorie: Categorie }) {
  const [edition, setEdition] = useState(false);
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(
    modifierCategorie.bind(null, categorie.id),
    {},
  );
  const dejaEnvoye = useRef(false);

  // Modification réussie → on referme la ligne. En cas d'erreur, elle reste
  // ouverte avec le message affiché.
  useEffect(() => {
    if (enCours) {
      dejaEnvoye.current = true;
    } else if (dejaEnvoye.current && !etat.erreurs && !etat.message) {
      dejaEnvoye.current = false;
      setEdition(false);
    }
  }, [enCours, etat]);

  if (edition) {
    return (
      <li className="px-4 py-3">
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            name="color"
            defaultValue={categorie.color ?? "#64748b"}
            aria-label="Couleur"
            className="size-8 shrink-0 cursor-pointer rounded-[3px] rounded-xl border border-reglure bg-card p-0.5"
          />
          <Input
            name="name"
            defaultValue={categorie.name}
            required
            maxLength={60}
            aria-label="Nom de la catégorie"
            className="h-9 min-w-40 flex-1 border-reglure bg-card"
          />
          <Input
            name="codeSyscohada"
            defaultValue={categorie.codeSyscohada ?? ""}
            inputMode="numeric"
            placeholder="Code"
            aria-label="Code SYSCOHADA"
            className="code-compte h-9 w-24 border-reglure bg-card"
          />
          <div className="flex items-center gap-1">
            <Button
              type="submit"
              size="icon"
              variant="secondary"
              disabled={enCours}
              aria-label="Enregistrer"
            >
              <Check className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Annuler"
              onClick={() => setEdition(false)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </form>
        {(etat.erreurs || etat.message) && (
          <p role="alert" className="mt-2 text-sm text-brique">
            {etat.erreurs?.name?.[0] ??
              etat.erreurs?.codeSyscohada?.[0] ??
              etat.erreurs?.color?.[0] ??
              etat.message}
          </p>
        )}
      </li>
    );
  }

  const enUsage = categorie.nbUtilisations > 0;

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className="size-3 shrink-0 rounded-[3px]"
        style={{ backgroundColor: categorie.color ?? "var(--cat-8)" }}
      />
      <span className="code-compte w-12 shrink-0 text-muted-foreground">
        {categorie.codeSyscohada ?? "—"}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {categorie.name}
      </span>
      {categorie.isDefault && (
        <Badge variant="outline" className="shrink-0">
          Par défaut
        </Badge>
      )}
      <span className="chiffre shrink-0 text-xs text-muted-foreground">
        {enUsage
          ? `${categorie.nbUtilisations} usage${categorie.nbUtilisations > 1 ? "s" : ""}`
          : "inutilisée"}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Modifier ${categorie.name}`}
          onClick={() => setEdition(true)}
          className="text-muted-foreground hover:text-indigo"
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
        <form action={supprimerCategorie.bind(null, categorie.id)}>
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            disabled={enUsage}
            aria-label={`Supprimer ${categorie.name}`}
            title={
              enUsage
                ? "Des dépenses ou budgets utilisent cette catégorie."
                : undefined
            }
            className="text-muted-foreground hover:text-brique disabled:opacity-40"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </form>
      </div>
    </li>
  );
}
