/**
 * Liste les utilisateurs Clerk de la plateforme, avec leur identifiant.
 *
 * Sert à deux choses : savoir quel compte mettre dans SUPER_ADMIN_USER_IDS,
 * et vérifier après coup que l'identifiant autorisé correspond bien au compte
 * avec lequel on se connecte.
 *
 * Usage : npx tsx scripts/check-utilisateurs.ts
 */
import "dotenv/config";
import { createClerkClient } from "@clerk/backend";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

async function main() {
  const autorises = (process.env.SUPER_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const { data: utilisateurs } = await clerk.users.getUserList({ limit: 100 });

  console.log(`=== ${utilisateurs.length} utilisateur(s) ===\n`);

  for (const u of utilisateurs) {
    const nom =
      [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "—";
    const email = u.emailAddresses[0]?.emailAddress ?? "—";
    const marque = autorises.includes(u.id) ? "  ← ÉDITEUR (accès /editeur)" : "";
    console.log(`${nom}`);
    console.log(`  email : ${email}`);
    console.log(`  id    : ${u.id}${marque}`);
    console.log("");
  }

  if (autorises.length === 0) {
    console.log("⚠ SUPER_ADMIN_USER_IDS est vide : /editeur répond 404 à tout le monde.");
  }
}

main().catch((e) => {
  console.error("Erreur :", e instanceof Error ? e.message : e);
  process.exit(1);
});
