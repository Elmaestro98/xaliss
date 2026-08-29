/**
 * Vérifie que la garde de portée fait ce qu'elle promet (lib/prisma.ts).
 *
 * Lecture seule : aucune écriture, aucune migration. À relancer après toute
 * modification de la garde.
 *
 * Usage : npx tsx scripts/test-garde-portee.ts
 */
import "dotenv/config";
import { prisma, prismaHorsPortee, prismaPourOrg } from "../src/lib/prisma";

const ORG = "org_3GhVASsLXO2uqf3oRy6623z9VRp"; // « Med's Organization »

/*
 * Client porté sur une entreprise nommée, et non `prisma`.
 *
 * Ce script tourne en ligne de commande, sans session Clerk : `prisma` y
 * refuserait TOUT depuis l'arrivée du RLS, et on ne testerait plus la garde de
 * portée mais l'absence de session. `prismaPourOrg()` porte la même garde —
 * c'est le même code — tout en fournissant l'entreprise à la main.
 */
const db = prismaPourOrg(ORG);

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

/** Comme `doitRefuser`, mais pour le refus de portée RLS, dont le message diffère. */
async function doitRefuserRLS(intitule: string, requete: () => Promise<unknown>) {
  try {
    await requete();
    console.log(`✗ ${intitule}\n    la requête est passée sans portée d'entreprise`);
    echoues++;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.startsWith("Portée RLS introuvable")) {
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
    db.expense.findMany({ take: 1 }),
  );

  await doitRefuser("expense.findMany() filtré sur autre chose", () =>
    db.expense.findMany({ where: { amount: { gt: 0 } }, take: 1 }),
  );

  await doitRefuser("expense.count() sans filtre", () => db.expense.count());

  await doitRefuser("payment.groupBy() sans filtre", () =>
    db.payment.groupBy({ by: ["status"], _count: true }),
  );

  await doitRefuser("organization.findMany() sans filtre sur id", () =>
    db.organization.findMany({ take: 1 }),
  );

  // Le piège : une branche du OR n'est pas portée, donc le OR entier ramène
  // les lignes de tout le monde.
  await doitRefuser("expense.findMany() avec un OR partiellement porté", () =>
    db.expense.findMany({
      where: {
        OR: [{ organizationId: ORG }, { amount: { gt: 0 } }],
      },
      take: 1,
    }),
  );

  await doitRefuser("membership.deleteMany() sans portée", () =>
    // Refusée AVANT d'atteindre la base : rien n'est supprimé.
    db.membership.deleteMany({ where: { role: "EMPLOYE" } }),
  );

  console.log("\n=== Ce qui doit être ACCEPTÉ ===");

  await doitAccepter("expense.findMany() porté", () =>
    db.expense.findMany({ where: { organizationId: ORG }, take: 1 }),
  );

  await doitAccepter("expense.count() porté", () =>
    db.expense.count({ where: { organizationId: ORG } }),
  );

  await doitAccepter("organization.findMany() porté sur id", () =>
    db.organization.findMany({ where: { id: ORG } }),
  );

  await doitAccepter("category.findMany() porté via AND", () =>
    db.category.findMany({
      where: { AND: [{ organizationId: ORG }, { isDefault: true }] },
      take: 1,
    }),
  );

  await doitAccepter("expense.findMany() avec un OR entièrement porté", () =>
    db.expense.findMany({
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
    db.expense.findUnique({ where: { id: "inexistant" } }),
  );

  await doitAccepter("prismaHorsPortee.organization.findMany() (échappatoire)", () =>
    prismaHorsPortee.organization.findMany({ take: 1 }),
  );

  console.log("\n=== Portée RLS : sans entreprise, on refuse ===");

  // Le défaut le plus coûteux du RLS n'est pas l'erreur, c'est le silence :
  // sans `app.organization_id`, PostgreSQL ne se plaint pas, il renvoie zéro
  // ligne. Ce refus côté application transforme ce silence en panne visible.
  await doitRefuserRLS(
    "prisma (auto) hors requête HTTP — aucune session d'où déduire l'entreprise",
    () => prisma.expense.findUnique({ where: { id: "inexistant" } }),
  );

  console.log(`\n${reussis} réussis, ${echoues} échoués`);
  if (echoues > 0) process.exitCode = 1;
}

main().finally(() => prismaHorsPortee.$disconnect());
