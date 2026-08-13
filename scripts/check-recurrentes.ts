// Affiche les récurrences et les dernières dépenses du journal, pour
// vérifier la génération. Usage : npx tsx scripts/check-recurrentes.ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const recurrences = await prisma.recurringExpense.findMany({
    select: { template: true, frequency: true, nextRunAt: true, active: true },
  });
  console.log("=== Récurrences ===");
  for (const r of recurrences) {
    const gabarit = r.template as { amount?: number; supplier?: string };
    console.log(
      `- ${gabarit.supplier ?? "?"} ${gabarit.amount ?? "?"} FCFA [${r.frequency}] ` +
        `${r.active ? "active" : "en pause"} — prochaine : ${r.nextRunAt.toISOString().slice(0, 10)}`,
    );
  }

  const depenses = await prisma.expense.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { amount: true, supplier: true, date: true },
  });
  console.log("\n=== Dernières dépenses du journal ===");
  for (const d of depenses) {
    console.log(
      `- ${d.date.toISOString().slice(0, 10)} : ${d.amount} FCFA (${d.supplier ?? "sans fournisseur"})`,
    );
  }
}

main().finally(() => prisma.$disconnect());
