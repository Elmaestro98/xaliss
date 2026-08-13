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
  creerRecurrence,
  type EtatFormulaire,
} from "@/app/(app)/depenses/recurrentes/actions";
import { MOYENS_PAIEMENT } from "@/lib/paiement";

type Categorie = {
  id: string;
  name: string;
  codeSyscohada: string | null;
  color: string | null;
};

const FREQUENCES = [
  { valeur: "MENSUELLE", libelle: "Tous les mois" },
  { valeur: "TRIMESTRIELLE", libelle: "Tous les trois mois" },
] as const;

function Erreur({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-brique">
      {messages[0]}
    </p>
  );
}

export function FormulaireRecurrence({
  categories,
}: {
  categories: Categorie[];
}) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(
    creerRecurrence,
    {},
  );

  const aujourdhui = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="mt-6 space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="amount">Montant</Label>
          <div className="mt-1.5 flex items-baseline gap-2 border-b-2 border-reglure focus-within:border-indigo">
            <Input
              id="amount"
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
          <Label htmlFor="frequency">Fréquence</Label>
          <Select name="frequency" required defaultValue="MENSUELLE">
            <SelectTrigger id="frequency" className="mt-1.5 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCES.map((frequence) => (
                <SelectItem key={frequence.valeur} value={frequence.valeur}>
                  {frequence.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Erreur messages={etat.erreurs?.frequency} />
        </div>

        <div>
          <Label htmlFor="premiereEcheance">Première échéance</Label>
          <Input
            id="premiereEcheance"
            name="premiereEcheance"
            type="date"
            required
            defaultValue={aujourdhui}
            aria-describedby="aide-echeance"
            className="mt-1.5"
          />
          <p
            id="aide-echeance"
            className="mt-1.5 text-xs text-muted-foreground"
          >
            Une date passée rattrape les échéances manquées.
          </p>
          <Erreur messages={etat.erreurs?.premiereEcheance} />
        </div>

        <div>
          <Label htmlFor="paymentMethod">Payé par</Label>
          <Select name="paymentMethod" required>
            <SelectTrigger id="paymentMethod" className="mt-1.5 w-full">
              <SelectValue placeholder="Choisir" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(MOYENS_PAIEMENT).map(([valeur, moyen]) => (
                <SelectItem key={valeur} value={valeur}>
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-[2px]"
                      style={{ backgroundColor: moyen.couleur }}
                    />
                    {moyen.libelle}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Erreur messages={etat.erreurs?.paymentMethod} />
        </div>
      </div>

      <div>
        <Label htmlFor="categoryId">Catégorie</Label>
        <Select name="categoryId" required>
          <SelectTrigger id="categoryId" className="mt-1.5 w-full">
            <SelectValue placeholder="Choisir une catégorie" />
          </SelectTrigger>
          <SelectContent>
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
        <Erreur messages={etat.erreurs?.categoryId} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="supplier">Fournisseur</Label>
          <Input
            id="supplier"
            name="supplier"
            className="mt-1.5"
            placeholder="Bailleur, Sonatel…"
          />
          <Erreur messages={etat.erreurs?.supplier} />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            name="description"
            className="mt-1.5"
            placeholder="Loyer du local, abonnement internet…"
          />
          <Erreur messages={etat.erreurs?.description} />
        </div>
      </div>

      {etat.message && (
        <p role="alert" className="text-sm text-brique">
          {etat.message}
        </p>
      )}

      <Button type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Mettre en place la récurrence"}
      </Button>
    </form>
  );
}
