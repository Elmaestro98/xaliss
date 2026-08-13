"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
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
import { creerDepense, type EtatFormulaire } from "@/app/(app)/depenses/actions";
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

export function FormulaireDepense({ categories }: { categories: Categorie[] }) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(
    creerDepense,
    {},
  );

  const aujourdhui = new Date().toISOString().slice(0, 10);

  // Champs contrôlés : l'OCR doit pouvoir écrire dedans après coup — un
  // simple defaultValue serait figé au premier rendu.
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(aujourdhui);
  const [categorieId, setCategorieId] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [ocr, setOcr] = useState<EtatOcr>({ statut: "inactif" });
  // Compteur de requêtes : si l'utilisateur change de fichier pendant une
  // analyse, seule la réponse de la DERNIÈRE compte.
  const requeteOcr = useRef(0);

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
      if (numero !== requeteOcr.current) return; // réponse périmée

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

      // Pré-remplissage : on n'écrase jamais avec du vide, et la date ne
      // peut pas être dans le futur (même règle que la saisie manuelle).
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
    <form action={action} className="mt-8 space-y-6">
      {/*
        Le justificatif d'abord : photographier le reçu déclenche l'OCR qui
        pré-remplit le reste — l'ordre du formulaire suit le geste réel
        (PROJET.md §9). La validation humaine reste obligatoire.
      */}
      <div>
        <Label htmlFor="justificatif">Justificatif</Label>
        <Input
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
            className="titre chiffre h-auto border-0 bg-transparent px-0 py-1 text-4xl shadow-none focus-visible:ring-0 md:text-5xl"
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
          id="description"
          name="description"
          className="mt-1.5"
          placeholder="À quoi correspond cette dépense ?"
        />
        <Erreur messages={etat.erreurs?.description} />
      </div>

      {/*
        Le résultat brut de l'OCR accompagne la soumission : l'action le
        range dans Receipt.ocrData pour l'audit (PROJET.md §9), même si
        l'utilisateur a corrigé les champs à la main.
      */}
      {ocr.statut === "ok" && (
        <input
          type="hidden"
          name="ocrData"
          value={JSON.stringify(ocr.resultat)}
        />
      )}

      {etat.message && (
        <p role="alert" className="text-sm text-brique">
          {etat.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={enCours || ocr.statut === "analyse"}>
          {enCours ? "Enregistrement…" : "Enregistrer la dépense"}
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/depenses">Annuler</Link>
        </Button>
      </div>
    </form>
  );
}
