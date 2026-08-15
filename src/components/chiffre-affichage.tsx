import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatNombre } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Le montant héros — un seul par écran.
 *
 * C'est lui qui répond à la question qu'on se pose en ouvrant la page, avant
 * même d'avoir lu un titre : combien. Tout le reste de l'écran est plus petit
 * que lui, sinon il ne sert à rien.
 *
 * L'unité (« FCFA ») est écrite à côté, jamais collée au nombre : le montant
 * est un chiffre à comparer d'un coup d'œil, pas une chaîne à lire.
 */
export function ChiffreAffichage({
  montant,
  unite = "FCFA",
  variation,
  comparaison,
  className,
}: {
  montant: number;
  unite?: string;
  /** Écart en % vs la période précédente. `null` = rien à comparer. */
  variation?: number | null;
  /** Ce à quoi on compare, en toutes lettres : « vs juillet ». */
  comparaison?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end gap-x-3 gap-y-2", className)}>
      <span className="chiffre-affichage text-foreground">
        {formatNombre(montant)}
      </span>
      <span className="mention pb-1.5">{unite}</span>

      {variation != null && variation !== 0 && (
        <VariationDepense variation={variation} comparaison={comparaison} />
      )}
    </div>
  );
}

/**
 * ⚠️ Le sens des couleurs s'inverse par rapport à un tableau de bord de
 * chiffre d'affaires. Ici on compte des DÉPENSES : dépenser plus que le mois
 * dernier est un signal rouge, dépenser moins est vert. Reprendre le réflexe
 * « hausse = vert » d'un dashboard de revenus féliciterait le gérant pour un
 * dérapage budgétaire.
 */
function VariationDepense({
  variation,
  comparaison,
}: {
  variation: number;
  comparaison?: string;
}) {
  const hausse = variation > 0;
  const Fleche = hausse ? ArrowUpRight : ArrowDownRight;

  return (
    <span className="flex items-center gap-1.5 pb-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
          hausse ? "bg-brique/15 text-brique" : "bg-vert/15 text-vert",
        )}
      >
        <Fleche className="size-3.5" aria-hidden />
        <span className="chiffre">{Math.abs(variation)} %</span>
      </span>
      {comparaison && (
        <span className="text-xs text-muted-foreground">{comparaison}</span>
      )}
    </span>
  );
}
