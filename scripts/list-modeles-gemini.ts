// Liste les modèles Gemini disponibles pour la clé configurée.
// Usage : npx tsx scripts/list-modeles-gemini.ts
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

async function main() {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const pager = await client.models.list();
  for await (const modele of pager) {
    const actions = modele.supportedActions?.join(", ") ?? "";
    if (actions.includes("generateContent")) {
      console.log(`- ${modele.name}`);
    }
  }
}

main();
