// Teste l'extraction OCR de bout en bout avec une image de reçu locale.
// Usage : npx tsx --conditions react-server scripts/test-ocr.ts <chemin-image>
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { extraireDonneesRecu } from "../src/lib/ocr";
import { prisma } from "../src/lib/prisma";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

async function main() {
  const chemin = process.argv[2];
  if (!chemin) throw new Error("Donnez le chemin d'une image de reçu.");

  const type = TYPES[path.extname(chemin).toLowerCase()];
  if (!type) throw new Error("Extension non gérée.");

  // Les vraies catégories de la base, comme le ferait /api/ocr.
  const categories = await prisma.category.findMany({
    select: { name: true },
    take: 50,
  });

  const contenu = fs.readFileSync(chemin);
  const fichier = new File([contenu], path.basename(chemin), { type });

  console.log(`Analyse de ${path.basename(chemin)} (${contenu.length} octets)…`);
  const debut = Date.now();
  const resultat = await extraireDonneesRecu({
    fichier,
    nomsCategories: categories.map((c) => c.name),
  });
  console.log(`Terminé en ${((Date.now() - debut) / 1000).toFixed(1)} s :`);
  console.log(JSON.stringify(resultat, null, 2));
}

main()
  .catch((e) => {
    console.error("Échec :", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
