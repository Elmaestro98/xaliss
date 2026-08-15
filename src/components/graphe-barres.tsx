"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatFCFA } from "@/lib/format";

type Barre = { id: string; label: string; montant: number };

// L'indigo suit déjà le thème dans globals.css : plus besoin de le décliner ici.
const config = {
  montant: { label: "Dépenses", color: "var(--indigo)" },
} satisfies ChartConfig;

/**
 * Répartition en barres horizontales classées (par employé…). Une seule encre :
 * ici la couleur ne distingue pas les personnes, elle classe des montants. Le
 * nom reste en toutes lettres sur l'axe, le montant apparaît au survol.
 */
export function GrapheBarres({ items }: { items: Barre[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucune dépense ce mois-ci.</p>
    );
  }

  return (
    <ChartContainer config={config} className="aspect-[16/10] w-full">
      <BarChart
        accessibilityLayer
        data={items}
        layout="vertical"
        margin={{ left: 4, right: 16 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={104}
          tickMargin={4}
        />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value) => (
                <span className="chiffre font-medium text-foreground">
                  {formatFCFA(Number(value))}
                </span>
              )}
            />
          }
        />
        <Bar
          dataKey="montant"
          fill="var(--color-montant)"
          radius={[0, 6, 6, 0]}
          barSize={20}
        />
      </BarChart>
    </ChartContainer>
  );
}
