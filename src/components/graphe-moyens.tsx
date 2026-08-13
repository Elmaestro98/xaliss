"use client";

import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatFCFA } from "@/lib/format";

type Moyen = { id: string; label: string; couleur: string; montant: number };

/**
 * Répartition par moyen de paiement (PROJET.md §4.4) en anneau. Les couleurs
 * sont celles des VRAIES marques (Wave, Orange Money…) : ce sont des données,
 * pas du décor. Comme elles peuvent être claires, la légende chiffrée sous
 * l'anneau porte chaque montant en toutes lettres — la couleur n'informe jamais
 * seule.
 */
export function GrapheMoyens({ moyens }: { moyens: Moyen[] }) {
  if (moyens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucune dépense ce mois-ci.</p>
    );
  }

  const config: ChartConfig = Object.fromEntries(
    moyens.map((moyen) => [moyen.label, { label: moyen.label, color: moyen.couleur }]),
  );

  return (
    <div>
      <ChartContainer config={config} className="mx-auto aspect-square max-h-48">
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
            innerRadius={48}
            strokeWidth={2}
            stroke="var(--card)"
          >
            {moyens.map((moyen) => (
              <Cell key={moyen.id} fill={moyen.couleur} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <ul className="mt-3 space-y-1.5">
        {moyens.map((moyen) => (
          <li key={moyen.id} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[2px]"
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
