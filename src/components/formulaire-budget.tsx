"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  creerBudget,
  type EtatFormulaire,
} from "@/app/(app)/budgets/actions";

type Categorie = {
  id: string;
  name: string;
  codeSyscohada: string | null;
  color: string | null;
};

/** Même sentinelle que dans budgets/actions.ts (voir le commentaire là-bas). */
const BUDGET_GLOBAL = "global";

const PERIODES = [
  { valeur: "MONTHLY", libelle: "Par mois" },
  { valeur: "QUARTERLY", libelle: "Par trimestre" },
] as const;

function Erreur({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-brique">
      {messages[0]}
    </p>
  );
}

export function FormulaireBudget({
  categories,
  seuilAlerte,
}: {
  categories: Categorie[];
  seuilAlerte: number;
}) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(
    creerBudget,
    {},
  );

  return (
    <form action={action} className="mt-6 space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="budget-amount">Montant du budget</Label>
          <div className="mt-1.5 flex items-baseline gap-2 border-b-2 border-reglure focus-within:border-indigo">
            <Input
              id="budget-amount"
              name="amount"
              type="number"
              inputMode="numeric"
              step={1}
              min={1}
              required
              placeholder="0"
              className="chiffre h-auto border-0 bg-transparent px-0 py-1 text-2xl shadow-none focus-visible:ring-0"
            />
            <span className="code-compte shrink-0 text-muted-foreground">
              FCFA
            </span>
          </div>
          <Erreur messages={etat.erreurs?.amount} />
        </div>

        <div>
          <Label htmlFor="budget-period">Période</Label>
          <Select name="period" required defaultValue="MONTHLY">
            <SelectTrigger id="budget-period" className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODES.map((periode) => (
                <SelectItem key={periode.valeur} value={periode.valeur}>
                  {periode.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Erreur messages={etat.erreurs?.period} />
        </div>
      </div>

      <div>
        <Label htmlFor="budget-categorie">Portée</Label>
        <Select name="categoryId" required defaultValue={BUDGET_GLOBAL}>
          <SelectTrigger id="budget-categorie" className="mt-1.5 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={BUDGET_GLOBAL}>
              Global — toutes les dépenses
            </SelectItem>
            {categories.map((categorie) => (
              <SelectItem key={categorie.id} value={categorie.id}>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-[2px]"
                    style={{ backgroundColor: categorie.color ?? "#94a3b8" }}
                  />
                  {categorie.name}
                  <span className="code-compte text-muted-foreground">
                    {categorie.codeSyscohada}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Les alertes partent à {seuilAlerte} % puis 100 % du budget.
        </p>
        <Erreur messages={etat.erreurs?.categoryId} />
      </div>

      {etat.message && (
        <p role="alert" className="text-sm text-brique">
          {etat.message}
        </p>
      )}

      <Button type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Créer le budget"}
      </Button>
    </form>
  );
}
