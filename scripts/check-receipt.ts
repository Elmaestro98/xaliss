// Script jetable : affiche les dernières dépenses et leurs justificatifs
// pour vérifier l'upload de bout en bout. Usage : npx tsx check-receipt.ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const depenses = await prisma.expense.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
    select: {
      amount: true,
      supplier: true,
      createdAt: true,
      receipts: {
        select: {
          fileUrl: true,
          ocrStatus: true,
          ocrData: true,
          confidence: true,
          createdAt: true,
        },
      },
    },
  });

  for (const d of depenses) {
    console.log(
      `- ${d.amount} FCFA (${d.supplier ?? "sans fournisseur"}) saisie le ${d.createdAt.toISOString()}`,
    );
    if (d.receipts.length === 0) {
      console.log("    justificatif : aucun");
    }
    for (const r of d.receipts) {
      console.log(
        `    justificatif : ${r.fileUrl} [ocr: ${r.ocrStatus}] le ${r.createdAt.toISOString()}`,
      );
      if (r.ocrData) {
        console.log(
          `    ocr archivé (confiance ${r.confidence}) : ${JSON.stringify(r.ocrData)}`,
        );
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
