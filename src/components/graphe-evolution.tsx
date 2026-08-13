"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatFCFA } from "@/lib/format";

type Point = { label: string; montant: number };

// Encre indigo, déclinée pour chaque thème : le #2b3a8f du clair serait trop
// sombre sur la couverture nocturne du cahier.
const config = {
  montant: { label: "Dépenses", theme: { light: "#2b3a8f", dark: "#8c9cf0" } },
} satisfies ChartConfig;

/**
 * L'évolution mensuelle (PROJET.md §4.4) : une aire, la tendance d'un coup
 * d'œil. Le montant exact d'un mois apparaît au survol — le total du mois est
 * déjà écrit en grand plus haut.
 */
export function GrapheEvolution({ points }: { points: Point[] }) {
  return (
    <ChartContainer config={config} className="aspect-[16/6] w-full">
      <AreaChart accessibilityLayer data={points} margin={{ left: 4, right: 4, top: 8 }}>
        <defs>
          <linearGradient id="fill-evolution" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-montant)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-montant)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--reglure)" }}
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
        <Area
          dataKey="montant"
          type="monotone"
          stroke="var(--color-montant)"
          strokeWidth={2}
          fill="url(#fill-evolution)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
