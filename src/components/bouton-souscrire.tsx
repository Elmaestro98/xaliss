"use client";

import { useActionState } from "react";
import type { BillingCycle, SubscriptionPlan } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import {
  type EtatFormulaire,
  souscrire,
} from "@/app/(app)/abonnement/actions";

/**
 * Le bouton de souscription d'une carte de plan.
 *
 * Un formulaire par plan plutôt qu'un grand formulaire à choix multiple : le
 * plan et la périodicité voyagent en champs cachés, et le serveur recalcule le
 * montant de toute façon (lib/facturation.ts). Ce qui part d'ici n'est donc
 * qu'une intention, jamais un prix.
 */
export function BoutonSouscrire({
  plan,
  cycle,
  libelle,
  variante = "default",
}: {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  libelle: string;
  variante?: "default" | "outline";
}) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(
    souscrire,
    {},
  );

  return (
    <form action={action} className="mt-6">
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="cycle" value={cycle} />

      <Button
        type="submit"
        variant={variante}
        disabled={enCours}
        className="w-full"
      >
        {enCours ? "Préparation du paiement…" : libelle}
      </Button>

      {etat.message && (
        <p role="alert" className="mt-2 text-sm text-brique">
          {etat.message}
        </p>
      )}
    </form>
  );
}
