/**
 * Vérifie que la garde de portée fait ce qu'elle promet (lib/prisma.ts).
 *
 * Lecture seule : aucune écriture, aucune migration. À relancer après toute
 * modification de la garde.
 *
 * Usage : npx tsx scripts/test-garde-portee.ts
 */
import "dotenv/config";
import { prisma, prismaHorsPortee } from "../src/lib/prisma";

const ORG = "org_3GhVASsLXO2uqf3oRy6623z9VRp"; // « Med's Organization »

let reussis = 0;
let echoues = 0;

async function doitRefuser(intitule: string, requete: () => Promise<unknown>) {
  try {
    await requete();
    console.log(`✗ ${intitule}\n    la requête est passée alors qu'elle devait être refusée`);
    echoues++;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.startsWith("Portée manquante")) {
      console.log(`✓ ${intitule}`);
      reussis++;
    } else {
      console.log(`✗ ${intitule}\n    refusée, mais pour une autre raison : ${message}`);
      echoues++;
    }
  }
}

async function doitAccepter(intitule: string, requete: () => Promise<unknown>) {
  try {
    await requete();
    console.log(`✓ ${intitule}`);
    reussis++;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`✗ ${intitule}\n    refusée à tort : ${message}`);
    echoues++;
  }
}

async function main() {
  console.log("=== Ce qui doit être REFUSÉ ===");

  await doitRefuser("expense.findMany() sans filtre", () =>
    prisma.expense.findMany({ take: 1 }),
  );

  await doitRefuser("expense.findMany() filtré sur autre chose", () =>
    prisma.expense.findMany({ where: { amount: { gt: 0 } }, take: 1 }),
  );

  await doitRefuser("expense.count() sans filtre", () => prisma.expense.count());

  await doitRefuser("payment.groupBy() sans filtre", () =>
    prisma.payment.groupBy({ by: ["status"], _count: true }),
  );

  await doitRefuser("organization.findMany() sans filtre sur id", () =>
    prisma.organization.findMany({ take: 1 }),
  );

  // Le piège : une branche du OR n'est pas portée, donc le OR entier ramène
  // les lignes de tout le monde.
  await doitRefuser("expense.findMany() avec un OR partiellement porté", () =>
    prisma.expense.findMany({
      where: {
        OR: [{ organizationId: ORG }, { amount: { gt: 0 } }],
      },
      take: 1,
    }),
  );

  await doitRefuser("membership.deleteMany() sans portée", () =>
    // Refusée AVANT d'atteindre la base : rien n'est supprimé.
    prisma.membership.deleteMany({ where: { role: "EMPLOYE" } }),
  );

  console.log("\n=== Ce qui doit être ACCEPTÉ ===");

  await doitAccepter("expense.findMany() porté", () =>
    prisma.expense.findMany({ where: { organizationId: ORG }, take: 1 }),
  );

  await doitAccepter("expense.count() porté", () =>
    prisma.expense.count({ where: { organizationId: ORG } }),
  );

  await doitAccepter("organization.findMany() porté sur id", () =>
    prisma.organization.findMany({ where: { id: ORG } }),
  );

  await doitAccepter("category.findMany() porté via AND", () =>
    prisma.category.findMany({
      where: { AND: [{ organizationId: ORG }, { isDefault: true }] },
      take: 1,
    }),
  );

  await doitAccepter("expense.findMany() avec un OR entièrement porté", () =>
    prisma.expense.findMany({
      where: {
        OR: [
          { organizationId: ORG, amount: { gt: 0 } },
          { organizationId: ORG, supplier: { not: null } },
        ],
      },
      take: 1,
    }),
  );

  await doitAccepter("findUnique par identifiant (hors garde, voir lib/prisma.ts)", () =>
    prisma.expense.findUnique({ where: { id: "inexistant" } }),
  );

  await doitAccepter("prismaHorsPortee.organization.findMany() (échappatoire)", () =>
    prismaHorsPortee.organization.findMany({ take: 1 }),
  );

  console.log(`\n${reussis} réussis, ${echoues} échoués`);
  if (echoues > 0) process.exitCode = 1;
}

main().finally(() => prismaHorsPortee.$disconnect());
