"use client";

import { useActionState } from "react";
import { useRetourAction } from "@/hooks/use-retour-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  declarerAvoirPaye,
  type EtatFormulaire,
} from "@/app/(app)/abonnement/actions";

/**
 * « J'ai payé » — le gérant recopie l'identifiant de son reçu Wave.
 *
 * Le champ est obligatoire à dessein : sans pièce à rapprocher, la déclaration
 * serait un simple clic, et l'éditeur n'aurait rien pour retrouver le versement
 * parmi ceux de la journée.
 */
export function FormulaireDeclarationPaiement({
  reference,
}: {
  reference: string;
}) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(
    // bind fige la référence côté serveur : elle ne transite pas par un champ
    // du formulaire, où elle serait remplaçable depuis la console.
    declarerAvoirPaye.bind(null, reference),
    {},
  );

  useRetourAction(etat);

  return (
    <form action={action} className="mt-4">
      <Label htmlFor="transactionId">Identifiant de la transaction Wave</Label>
      <Input
        id="transactionId"
        name="transactionId"
        required
        placeholder="TA..."
        aria-describedby="aide-transaction"
        className="mt-1.5 max-w-sm"
      />
      <p id="aide-transaction" className="mt-1.5 text-xs text-muted-foreground">
        Il figure sur le reçu affiché par Wave après le paiement, et dans
        l&apos;historique de votre application Wave.
      </p>

      {etat.erreurs?.transactionId && (
        <p role="alert" className="mt-1.5 text-sm text-brique">
          {etat.erreurs.transactionId[0]}
        </p>
      )}
      {/* La réussite passe par un toast ; ici ne reste que ce qui doit être lu
          pour corriger quelque chose. */}
      {etat.message && !etat.succes && (
        <p role="alert" className="mt-2 text-sm text-brique">
          {etat.message}
        </p>
      )}

      <Button type="submit" disabled={enCours} className="mt-4">
        {enCours ? "Enregistrement…" : "J'ai payé"}
      </Button>
    </form>
  );
}
