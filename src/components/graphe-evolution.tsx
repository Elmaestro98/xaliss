"use client";

import { Bar, BarChart, Cell, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { MotifReglure, REMPLISSAGE_REGLURE } from "@/components/motif-reglure";
import { formatFCFA } from "@/lib/format";

type Point = { label: string; montant: number };

const config = {
  montant: { label: "Dépenses", color: "var(--indigo)" },
} satisfies ChartConfig;

/**
 * L'évolution mensuelle (PROJET.md §4.4) — et le geste signature de Xaalis.
 *
 * Les mois passés sont RÉGLÉS : remplis du papier du cahier, présents mais pas
 * le sujet. Le mois courant est écrit à l'encre indigo, plein. C'est la seule
 * chose que l'œil attrape en arrivant, et c'est la bonne : « où j'en suis
 * maintenant », pas « où j'en étais en mars ».
 *
 * Volontairement sans étiquette de montant sur les barres. En FCFA un mois
 * s'écrit « 1 250 000 » — sept caractères qui ne tiennent pas dans une barre
 * de téléphone. Le total exact est déjà en grand au-dessus du graphe, et
 * chaque mois se lit au toucher.
 */
export function GrapheEvolution({ points }: { points: Point[] }) {
  const dernier = points.length - 1;

  return (
    <ChartContainer config={config} className="aspect-[16/7] w-full">
      <BarChart
        accessibilityLayer
        data={points}
        margin={{ left: 4, right: 4, top: 8 }}
      >
        <defs>
          <MotifReglure />
        </defs>
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={10}
        />
        <ChartTooltip
          // Le curseur par défaut pose un bloc plein derrière la barre visée et
          // efface sa réglure. Un simple contour la laisse lisible.
          cursor={{ fill: "transparent", stroke: "var(--reglure)" }}
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="chiffre font-medium text-foreground">
                  {formatFCFA(Number(value))}
                </span>
              )}
            />
          }
        />
        <Bar dataKey="montant" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {points.map((point, index) => (
            <Cell
              key={point.label}
              fill={index === dernier ? "var(--indigo)" : REMPLISSAGE_REGLURE}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
