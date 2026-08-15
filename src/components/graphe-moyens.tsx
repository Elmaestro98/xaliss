"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatFCFA, formatNombre } from "@/lib/format";

type Moyen = { id: string; label: string; couleur: string; montant: number };

/**
 * Répartition par moyen de paiement (PROJET.md §4.4) en anneau. Les couleurs
 * sont celles des VRAIES marques (Wave, Orange Money…) : ce sont des données,
 * pas du décor. Comme elles peuvent être claires, la légende chiffrée sous
 * l'anneau porte chaque montant en toutes lettres — la couleur n'informe jamais
 * seule.
 *
 * Le total vit au centre de l'anneau : c'est le seul endroit où la somme des
 * parts et les parts elles-mêmes se lisent d'un même regard.
 */
export function GrapheMoyens({ moyens }: { moyens: Moyen[] }) {
  if (moyens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucune dépense ce mois-ci.</p>
    );
  }

  const total = moyens.reduce((somme, moyen) => somme + moyen.montant, 0);

  const config: ChartConfig = Object.fromEntries(
    moyens.map((moyen) => [
      moyen.label,
      { label: moyen.label, color: moyen.couleur },
    ]),
  );

  return (
    <div>
      <div className="relative mx-auto aspect-square max-h-52">
        <ChartContainer config={config} className="size-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  nameKey="label"
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="chiffre font-medium text-foreground">
                        {formatFCFA(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={moyens}
              dataKey="montant"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              strokeWidth={0}
            >
              {moyens.map((moyen) => (
                <Cell key={moyen.id} fill={moyen.couleur} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Superposé plutôt que dessiné par recharts : le centre porte de la
            typographie (chiffres tabulaires, mention), pas de la donnée. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="titre chiffre text-xl">{formatNombre(total)}</span>
          <span className="mention">FCFA</span>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {moyens.map((moyen) => (
          <li key={moyen.id} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: moyen.couleur }}
            />
            <span className="min-w-0 flex-1 truncate">{moyen.label}</span>
            <span className="chiffre shrink-0 font-medium">
              {formatFCFA(moyen.montant)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
