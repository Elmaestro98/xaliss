"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { Loader2, ScanLine } from "lucide-react";
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
  ajouterDepenseNote,
  type EtatAjoutDepense,
} from "@/app/(app)/notes-de-frais/actions";
import { MOYENS_PAIEMENT } from "@/lib/paiement";

type Categorie = {
  id: string;
  name: string;
  codeSyscohada: string | null;
  color: string | null;
};

/** Réponse de /api/ocr — voir lib/ocr.ts pour le schéma complet. */
type ResultatOcr = {
  amount: number | null;
  currency: string | null;
  date: string | null;
  supplier: string | null;
  suggestedCategory: string | null;
  confidence: number;
};

type EtatOcr =
  | { statut: "inactif" }
  | { statut: "analyse" }
  | { statut: "ok"; resultat: ResultatOcr }
  | { statut: "erreur"; message: string };

function Erreur({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-brique">
      {messages[0]}
    </p>
  );
}

/**
 * Même formulaire que FormulaireDepense (OCR compris), mais qui alimente
 * une note de frais au lieu du journal direct : c'est la porte d'entrée
 * d'un employé sans `expenses:write` (PROJET.md §5). Pas de redirection
 * après l'ajout — l'employé enchaîne les dépenses de la même note, le
 * formulaire se réinitialise et la liste ci-dessous se met à jour seule.
 */
export function FormulaireDepenseNote({
  reportId,
  categories,
}: {
  reportId: string;
  categories: Categorie[];
}) {
  const [etat, action, enCours] = useActionState<EtatAjoutDepense, FormData>(
    ajouterDepenseNote.bind(null, reportId),
    {},
  );

  const aujourdhui = new Date().toISOString().slice(0, 10);

  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(aujourdhui);
  const [categorieId, setCategorieId] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [cleFichier, setCleFichier] = useState(0);
  const [ocr, setOcr] = useState<EtatOcr>({ statut: "inactif" });
  const requeteOcr = useRef(0);

  // Une réussite vide le formulaire pour la dépense suivante — la clé du
  // champ fichier change pour forcer React à recréer l'input natif. Ajusté
  // pendant le rendu plutôt qu'en effet (pattern React officiel « Adjusting
  // state when a prop changes », un useState comme mémoire du rendu
  // précédent — un useRef ne s'y prête pas, le compilateur React l'interdit
  // en lecture pendant le rendu).
  const [dernierEtatTraite, setDernierEtatTraite] =
    useState<EtatAjoutDepense>(etat);
  if (etat.succes && etat !== dernierEtatTraite) {
    setDernierEtatTraite(etat);
    setMontant("");
    setDate(aujourdhui);
    setCategorieId("");
    setFournisseur("");
    setOcr({ statut: "inactif" });
    setCleFichier((c) => c + 1);
  }

  async function analyserJustificatif(fichier: File | undefined) {
    if (!fichier) {
      setOcr({ statut: "inactif" });
      return;
    }

    const numero = ++requeteOcr.current;
    setOcr({ statut: "analyse" });

    try {
      const corps = new FormData();
      corps.append("fichier", fichier);
      const reponse = await fetch("/api/ocr", { method: "POST", body: corps });
      if (numero !== requeteOcr.current) return;

      if (!reponse.ok) {
        const detail = (await reponse.json().catch(() => null)) as {
          erreur?: string;
        } | null;
        setOcr({
          statut: "erreur",
          message:
            detail?.erreur ??
            "Analyse impossible pour le moment. Saisissez manuellement.",
        });
        return;
      }

      const resultat = (await reponse.json()) as ResultatOcr;
      if (numero !== requeteOcr.current) return;

      if (resultat.amount) setMontant(String(resultat.amount));
      if (resultat.date && resultat.date <= aujourdhui) setDate(resultat.date);
      if (resultat.supplier) setFournisseur(resultat.supplier);
      if (resultat.suggestedCategory) {
        const categorie = categories.find(
          (c) => c.name === resultat.suggestedCategory,
        );
        if (categorie) setCategorieId(categorie.id);
      }
      setOcr({ statut: "ok", resultat });
    } catch {
      if (numero !== requeteOcr.current) return;
      setOcr({
        statut: "erreur",
        message: "Analyse impossible pour le moment. Saisissez manuellement.",
      });
    }
  }

  return (
    <form action={action} className="space-y-6">
      <div>
        <Label htmlFor="justificatif">Justificatif</Label>
        <Input
          key={cleFichier}
          id="justificatif"
          name="justificatif"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          aria-describedby="aide-justificatif"
          className="mt-1.5"
          disabled={ocr.statut === "analyse"}
          onChange={(evenement) =>
            analyserJustificatif(evenement.target.files?.[0])
          }
        />
        <p
          id="aide-justificatif"
          className="mt-1.5 text-xs text-muted-foreground"
        >
          Photo du reçu ou PDF, 10 Mo maximum. Facultatif.
        </p>

        {ocr.statut === "analyse" && (
          <p
            role="status"
            className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Lecture du reçu en cours…
          </p>
        )}
        {ocr.statut === "ok" && (
          <p role="status" className="mt-2 flex items-center gap-2 text-sm">
            <ScanLine className="size-4 text-indigo" aria-hidden />
            Reçu analysé (confiance {Math.round(ocr.resultat.confidence * 100)}
            %). Vérifiez les champs avant d&apos;enregistrer.
          </p>
        )}
        {ocr.statut === "erreur" && (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            {ocr.message}
          </p>
        )}
        <Erreur messages={etat.erreurs?.justificatif} />
      </div>

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
            value={montant}
            onChange={(e) => setMontant(e.target.value)}
            aria-describedby="aide-montant"
            className="titre chiffre h-auto border-0 bg-transparent px-0 py-1 text-3xl shadow-none focus-visible:ring-0"
          />
          <span className="code-compte shrink-0 text-muted-foreground">
            FCFA
          </span>
        </div>
        <p id="aide-montant" className="mt-1.5 text-xs text-muted-foreground">
          Montant entier, sans centimes.
        </p>
        <Erreur messages={etat.erreurs?.amount} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={aujourdhui}
            className="mt-1.5"
          />
          <Erreur messages={etat.erreurs?.date} />
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
                      className="size-2.5 rounded-full"
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
        <Select
          name="categoryId"
          required
          value={categorieId || undefined}
          onValueChange={setCategorieId}
        >
          <SelectTrigger id="categoryId" className="mt-1.5 w-full">
            <SelectValue placeholder="Choisir une catégorie" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((categorie) => (
              <SelectItem key={categorie.id} value={categorie.id}>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: categorie.color ?? "var(--cat-8)" }}
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

      <div>
        <Label htmlFor="supplier">Fournisseur</Label>
        <Input
          id="supplier"
          name="supplier"
          className="mt-1.5"
          placeholder="Total Ndar, Sonatel…"
          value={fournisseur}
          onChange={(e) => setFournisseur(e.target.value)}
        />
        <Erreur messages={etat.erreurs?.supplier} />
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Input
          key={cleFichier}
          id="description"
          name="description"
          className="mt-1.5"
          placeholder="À quoi correspond cette dépense ?"
          defaultValue=""
        />
        <Erreur messages={etat.erreurs?.description} />
      </div>

      {ocr.statut === "ok" && (
        <input
          type="hidden"
          name="ocrData"
          value={JSON.stringify(ocr.resultat)}
        />
      )}

      {etat.message && (
        <p
          role="alert"
          className={`text-sm ${etat.succes ? "text-vert" : "text-brique"}`}
        >
          {etat.message}
        </p>
      )}

      <Button type="submit" disabled={enCours || ocr.statut === "analyse"}>
        {enCours ? "Ajout…" : "Ajouter cette dépense"}
      </Button>
    </form>
  );
}
