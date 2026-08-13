// Script temporaire : affiche le contenu des tables Organization et Membership
// pour vérifier la synchronisation Clerk → Supabase. Usage : npx tsx check-db.ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const organisations = await prisma.organization.findMany({
    select: { id: true, name: true, createdAt: true },
  });
  const adhesions = await prisma.membership.findMany({
    select: { userId: true, organizationId: true, role: true },
  });

  console.log("=== Organisations ===");
  if (organisations.length === 0) console.log("(aucune)");
  for (const o of organisations) {
    console.log(`- ${o.name} (${o.id}) créée le ${o.createdAt.toISOString()}`);
  }

  console.log("\n=== Adhésions ===");
  if (adhesions.length === 0) console.log("(aucune)");
  for (const m of adhesions) {
    console.log(`- user ${m.userId} → org ${m.organizationId} [${m.role}]`);
  }
}

main()
  .catch((e) => {
    console.error("Erreur:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
