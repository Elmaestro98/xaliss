// Validation manuelle des paiements d'abonnement — PROJET.md §9.
//
// Depuis que Xaalis encaisse sur un lien de paiement Wave, aucun webhook signé
// ne confirme un versement : l'activation d'un abonnement est un geste de
// l'éditeur. Ce script est la façade de ce geste.
//
// Il n'écrit RIEN en base lui-même : il appelle /api/admin/paiements, qui passe
// par les mêmes fonctions que le reste de la facturation. Refaire l'activation
// ici créerait un second chemin d'encaissement, qui finirait par diverger.
//
// Prérequis : le serveur doit tourner, et ADMIN_SECRET être défini dans .env.
//
// Usage :
//   npx tsx scripts/valider-paiement.ts liste
//       → les déclarations en attente de vérification
//   npx tsx scripts/valider-paiement.ts valider XAA-2026-XXXX [montant]
//       → encaisse et active (le montant, s'il est donné, est confronté)
//   npx tsx scripts/valider-paiement.ts rejeter XAA-2026-XXXX
//       → marque le paiement en échec (déclaration sans versement)
//
// Marche à suivre : ouvrir Wave Business, retrouver le versement (montant +
// référence en motif), PUIS valider. Jamais l'inverse — la déclaration du
// client est saisie au clavier par la personne qui a intérêt à l'abonnement.
import "dotenv/config";

const BASE = process.env.XAALIS_URL ?? "http://localhost:3000";

const secret = process.env.ADMIN_SECRET;
if (!secret) {
  console.error(
    "ADMIN_SECRET manquant dans .env — la route d'administration refusera.",
  );
  process.exit(1);
}

const fcfa = (montant: number) => `${montant.toLocaleString("fr-FR")} FCFA`;

async function appeler(chemin: string, init?: RequestInit) {
  const reponse = await fetch(`${BASE}${chemin}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!reponse.ok) {
    const detail = await reponse.text().catch(() => "");
    throw new Error(`${reponse.status} ${reponse.statusText} — ${detail}`);
  }
  return reponse.json();
}

type PaiementEnAttente = {
  reference: string;
  entreprise: string;
  plan: string;
  cycle: string;
  montant: number;
  transactionId: string | null;
  declareLe: string;
};

async function liste() {
  const { nombre, paiements } = (await appeler("/api/admin/paiements")) as {
    nombre: number;
    paiements: PaiementEnAttente[];
  };

  if (nombre === 0) {
    console.log("Aucune déclaration en attente.");
    return;
  }

  console.log(`${nombre} déclaration(s) à vérifier :\n`);
  for (const p of paiements) {
    console.log(`  ${p.reference}`);
    console.log(`    entreprise  : ${p.entreprise}`);
    console.log(`    plan        : ${p.plan} (${p.cycle})`);
    console.log(`    montant     : ${fcfa(p.montant)}`);
    console.log(`    transaction : ${p.transactionId ?? "—"}`);
    console.log(
      `    déclaré le  : ${new Date(p.declareLe).toLocaleString("fr-FR")}`,
    );
    console.log("");
  }
  console.log(
    "Retrouvez chaque versement sur Wave Business AVANT de valider :\n" +
      "  npx tsx scripts/valider-paiement.ts valider <reference> [montant]",
  );
}

async function valider() {
  const reference = process.argv[3];
  if (!reference) {
    console.error("Référence attendue : valider XAA-2026-XXXX [montant]");
    process.exit(1);
  }

  const montantRecu = process.argv[4] ? Number(process.argv[4]) : undefined;
  if (montantRecu !== undefined && !Number.isInteger(montantRecu)) {
    console.error("Le montant doit être un entier de FCFA, sans décimales.");
    process.exit(1);
  }

  const { resultat } = (await appeler("/api/admin/paiements", {
    method: "POST",
    body: JSON.stringify({ reference, action: "valider", montantRecu }),
  })) as {
    resultat:
      | { type: "encaisse" }
      | { type: "deja-traite" }
      | { type: "introuvable" }
      | { type: "montant-incoherent"; attendu: number; recu: number };
  };

  switch (resultat.type) {
    case "encaisse":
      console.log(`✔ ${reference} encaissé — abonnement activé.`);
      break;
    case "deja-traite":
      console.log(`${reference} était déjà encaissé. Rien n'a changé.`);
      break;
    case "introuvable":
      console.error(`Référence inconnue : ${reference}`);
      process.exitCode = 1;
      break;
    case "montant-incoherent":
      console.error(
        `MONTANT INCOHÉRENT — attendu ${fcfa(resultat.attendu)}, vu ${fcfa(resultat.recu)}.`,
      );
      console.error(
        "Le paiement est marqué en échec, rien n'a été activé. Régularisez avec l'entreprise.",
      );
      process.exitCode = 1;
      break;
  }
}

async function rejeter() {
  const reference = process.argv[3];
  if (!reference) {
    console.error("Référence attendue : rejeter XAA-2026-XXXX");
    process.exit(1);
  }

  const { resultat } = (await appeler("/api/admin/paiements", {
    method: "POST",
    body: JSON.stringify({ reference, action: "rejeter" }),
  })) as { resultat: string };

  console.log(
    resultat === "rejete"
      ? `Paiement ${reference} marqué en échec.`
      : "Aucun paiement en attente sous cette référence (déjà encaissé ou inconnu).",
  );
}

const commandes: Record<string, () => Promise<void>> = {
  liste,
  valider,
  rejeter,
};

const commande = commandes[process.argv[2] ?? ""];
if (!commande) {
  console.error("Commande attendue : liste | valider | rejeter");
  process.exit(1);
}

commande().catch((e) => {
  console.error("ERREUR :", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
