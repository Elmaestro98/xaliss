// Script jetable : vérifie la connexion à Supabase Storage et l'existence
// du bucket "justificatifs", sans afficher aucune clé.
// Usage : npx tsx check-storage.ts
import "dotenv/config";
import { StorageClient } from "@supabase/storage-js";

async function main() {
  const url = process.env.SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`SUPABASE_URL définie : ${url ? "oui" : "NON"}`);
  console.log(`SUPABASE_SERVICE_ROLE_KEY définie : ${cle ? "oui" : "NON"}`);
  if (!url || !cle) return;

  if (url.includes("REMPLACE_MOI") || cle.includes("REMPLACE_MOI")) {
    console.log("⚠️ Une des valeurs contient encore REMPLACE_MOI");
    return;
  }

  const storage = new StorageClient(`${url}/storage/v1`, {
    apikey: cle,
    Authorization: `Bearer ${cle}`,
  });
  const { data, error } = await storage.listBuckets();

  if (error) {
    console.log(`Erreur de connexion au Storage : ${error.message}`);
    return;
  }

  console.log("Buckets trouvés :");
  for (const bucket of data) {
    console.log(`- ${bucket.name} (${bucket.public ? "PUBLIC ⚠️" : "privé ✅"})`);
  }
  if (!data.some((b) => b.name === "justificatifs")) {
    console.log("⚠️ Aucun bucket nommé exactement « justificatifs »");
  }
}

main();
