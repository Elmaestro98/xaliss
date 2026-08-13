// Déclenche à la main la génération des dépenses récurrentes échues, comme
// le ferait le cron quotidien (/api/cron/recurrentes) en production.
// Usage : npx tsx --conditions react-server scripts/run-recurrentes.ts
// (la condition react-server neutralise les imports "server-only", comme
// dans le vrai environnement serveur de Next.js)
import "dotenv/config";
import { genererDepensesEchues } from "../src/lib/recurrentes";
import { prisma } from "../src/lib/prisma";

async function main() {
  const { generees, ignorees } = await genererDepensesEchues();
  console.log(`Dépenses générées : ${generees}`);
  if (ignorees > 0) {
    console.log(`Récurrences ignorées (gabarit ou catégorie invalide) : ${ignorees}`);
  }
}

main().finally(() => prisma.$disconnect());
