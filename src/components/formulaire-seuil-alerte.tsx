"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  enregistrerSeuilAlerte,
  type EtatFormulaire,
} from "@/app/(app)/parametres/actions";

export function FormulaireSeuilAlerte({ seuilAlerte }: { seuilAlerte: number }) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(
    enregistrerSeuilAlerte,
    {},
  );

  return (
    <form
      action={action}
      className="mt-2 rounded-xl border border-reglure bg-card px-5 py-4"
    >
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label
            htmlFor="seuil-alerte"
            className="text-xs text-muted-foreground"
          >
            Premier seuil d&apos;alerte
          </Label>
          <div className="mt-1.5 flex items-baseline gap-2 border-b-2 border-reglure focus-within:border-indigo">
            <Input
              id="seuil-alerte"
              name="seuilAlerte"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              step={1}
              required
              defaultValue={seuilAlerte}
              className="chiffre h-auto w-20 border-0 bg-transparent px-0 py-1 text-2xl shadow-none focus-visible:ring-0"
            />
            <span className="code-compte shrink-0 text-muted-foreground">%</span>
          </div>
        </div>

        <Button type="submit" disabled={enCours} className="h-9">
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Un email part au gérant et au comptable dès qu&apos;un budget atteint ce
        seuil, puis de nouveau à 100 % (dépassement). S&apos;applique à tous les
        budgets.
      </p>

      {etat.erreurs?.seuilAlerte && (
        <p role="alert" className="mt-2 text-sm text-brique">
          {etat.erreurs.seuilAlerte[0]}
        </p>
      )}
      {etat.succes && (
        <p role="status" className="mt-2 text-sm text-vert">
          Seuil enregistré.
        </p>
      )}
    </form>
  );
}
