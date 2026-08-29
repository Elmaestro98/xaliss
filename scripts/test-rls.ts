/*
 * Vérifie l'isolation par entreprise, table par table.
 *
 * Se lit AVANT et APRÈS l'application des policies (prisma/migrations-rls/),
 * et c'est tout son intérêt :
 *
 *  - avant, il prouve que la mécanique de portée est en place — chaque table
 *    est atteignable, `app.organization_id` part bien avec la requête ;
 *  - après, il prouve que l'isolation MORD — une entreprise ne voit plus les
 *    lignes d'une autre.
 *
 * Le piège qu'il existe pour attraper : une portée oubliée ne plante pas une
 * fois les policies actives, elle renvoie ZÉRO ligne. Une application vide est
 * bien plus dure à diagnostiquer qu'une application qui tombe.
 *
 * Usage : npx tsx scripts/test-rls.ts
 */
import "dotenv/config";
import { prismaHorsPortee, prismaPourOrg } from "../src/lib/prisma";

/** Les 13 tables portées, et comment les compter pour une entreprise donnée. */
const TABLES: {
  nom: string;
  compter: (db: ReturnType<typeof prismaPourOrg>, org: string) => Promise<number>;
}[] = [
  { nom: "Organization", compter: (db, o) => db.organization.count({ where: { id: o } }) },
  { nom: "Membership", compter: (db, o) => db.membership.count({ where: { organizationId: o } }) },
  { nom: "Category", compter: (db, o) => db.category.count({ where: { organizationId: o } }) },
  { nom: "Expense", compter: (db, o) => db.expense.count({ where: { organizationId: o } }) },
  { nom: "RecurringExpense", compter: (db, o) => db.recurringExpense.count({ where: { organizationId: o } }) },
  { nom: "Budget", compter: (db, o) => db.budget.count({ where: { organizationId: o } }) },
  { nom: "ExpenseReport", compter: (db, o) => db.expenseReport.count({ where: { organizationId: o } }) },
  // Approval ne porte pas organizationId : sa portée vient de sa note de frais.
  {
    nom: "Approval",
    compter: (db, o) => db.approval.count({ where: { report: { organizationId: o } } }),
  },
  { nom: "Subscription", compter: (db, o) => db.subscription.count({ where: { organizationId: o } }) },
  { nom: "Payment", compter: (db, o) => db.payment.count({ where: { organizationId: o } }) },
  { nom: "OcrUsage", compter: (db, o) => db.ocrUsage.count({ where: { organizationId: o } }) },
  { nom: "AuditLog", compter: (db, o) => db.auditLog.count({ where: { organizationId: o } }) },
  // Receipt ne porte pas organizationId : sa portée vient de sa dépense.
  {
    nom: "Receipt",
    compter: (db, o) => db.receipt.count({ where: { expense: { organizationId: o } } }),
  },
];

/** Le même comptage, sans aucune portée : la vérité de référence. */
async function compterSansPortee(nom: string, org: string): Promise<number> {
  const client = prismaHorsPortee as unknown as Record<
    string,
    { count: (a: unknown) => Promise<number> }
  >;
  const cle = nom.charAt(0).toLowerCase() + nom.slice(1);
  const where =
    nom === "Organization"
      ? { id: org }
      : nom === "Receipt"
        ? { expense: { organizationId: org } }
        : nom === "Approval"
          ? { report: { organizationId: org } }
          : { organizationId: org };
  return client[cle].count({ where });
}

async function main() {
  const orgs = await prismaHorsPortee.organization.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  if (orgs.length < 2) {
    console.log("Il faut au moins deux entreprises pour tester l'isolation.");
    return;
  }
  const [a, b] = orgs;
  console.log(`Entreprise A : ${a.name}`);
  console.log(`Entreprise B : ${b.name}\n`);

  const db = prismaPourOrg(a.id);
  let echecs = 0;

  // ── 1. La variable de session part-elle avec la requête ? ──
  const [{ valeur }] = await db.$queryRaw<{ valeur: string | null }[]>`
    SELECT current_setting('app.organization_id', true) AS valeur`;
  console.log(
    `Contexte hors requête portée : ${valeur ?? "NULL"} (NULL attendu — la ` +
      `variable ne doit pas fuiter entre deux requêtes)\n`,
  );

  // ── 2. Chaque table, portée vs référence ──
  console.log("Table                comptage porté   référence   verdict");
  console.log("─".repeat(62));
  for (const table of TABLES) {
    let porte: number | string;
    try {
      porte = await table.compter(db, a.id);
    } catch (e) {
      porte = `ERREUR: ${(e as Error).message.split("\n")[0].slice(0, 30)}`;
    }
    const reference = await compterSansPortee(table.nom, a.id);
    const ok = porte === reference;
    if (!ok) echecs += 1;
    console.log(
      `${table.nom.padEnd(20)} ${String(porte).padStart(12)}   ${String(
        reference,
      ).padStart(9)}   ${ok ? "OK" : "<<< ECART"}`,
    );
  }

  // ── 3. L'isolation mord-elle ? ──
  // Tant que les policies ne sont pas posées, ce test échoue : c'est normal,
  // et c'est précisément ce qu'il faudra revoir après l'étape 4.
  console.log("\n── Isolation entre entreprises ──");
  const depenseDeB = await prismaHorsPortee.expense.findFirst({
    where: { organizationId: b.id },
    select: { id: true },
  });
  if (!depenseDeB) {
    console.log(`(${b.name} n'a aucune dépense : test non concluant)`);
  } else {
    // Portée sur A, on demande une ligne de B en la nommant par son id.
    const vol = await db.expense.findUnique({ where: { id: depenseDeB.id } });
    if (vol) {
      console.log(
        "A voit une dépense de B  →  policies PAS ENCORE actives (attendu " +
          "avant l'étape 4, à corriger après).",
      );
    } else {
      console.log("A ne voit pas la dépense de B  →  isolation active.");
    }
  }

  console.log(
    echecs === 0
      ? "\nToutes les tables sont atteignables avec leur portée."
      : `\n${echecs} table(s) en écart : une portée manque quelque part.`,
  );
  if (echecs > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("ERREUR:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prismaHorsPortee.$disconnect();
  });
