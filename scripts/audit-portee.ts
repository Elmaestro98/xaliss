/**
 * Audit statique de la portée des requêtes Prisma.
 *
 * Complément de `test-garde-portee.ts` : celui-là vérifie que la garde
 * fonctionne, celui-ci vérifie que le code la passe. La différence compte —
 * la garde ne se déclenche qu'à l'exécution, donc uniquement sur les chemins
 * que quelqu'un a réellement empruntés. Un audit statique voit aussi les pages
 * que personne n'a ouvertes depuis trois semaines.
 *
 * À lancer avant chaque déploiement : `npx tsx scripts/audit-portee.ts`
 *
 * Heuristique, et assumée comme telle. Trois pièges, appris à la dure :
 *  - la syntaxe abrégée `{ organizationId, … }` n'a pas de deux-points ;
 *  - le `where` est souvent une variable (`where: perimetre`) ;
 *  - le filtre peut arriver par un spread (`...perimetre`).
 * D'où la résolution d'un niveau de variable dans le même fichier. Un cas
 * tordu peut donc passer au travers : cet audit réduit le risque, il ne le
 * supprime pas. C'est la garde d'exécution qui a le dernier mot.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Doit rester aligné sur MODELES_GARDES de src/lib/prisma.ts. */
const MODELES: Record<string, string> = {
  organization: "id",
  membership: "organizationId",
  category: "organizationId",
  expense: "organizationId",
  recurringExpense: "organizationId",
  budget: "organizationId",
  expenseReport: "organizationId",
  approval: "organizationId",
  subscription: "organizationId",
  payment: "organizationId",
  ocrUsage: "organizationId",
  auditLog: "organizationId",
};

const OPERATIONS = [
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
];

function fichiers(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) {
      if (entree.name === "generated" || entree.name === "node_modules") continue;
      fichiers(chemin, acc);
    } else if (/\.tsx?$/.test(entree.name)) {
      acc.push(chemin);
    }
  }
  return acc;
}

/** Trouve la fermeture de la paire ouverte à `depart`. */
function finDuBloc(texte: string, depart: number, ouvrant: string, fermant: string) {
  let profondeur = 0;
  for (let i = depart; i < texte.length; i++) {
    if (texte[i] === ouvrant) profondeur++;
    else if (texte[i] === fermant) {
      profondeur--;
      if (profondeur === 0) return i;
    }
  }
  return texte.length - 1;
}

/** `organizationId:` OU `organizationId,` OU `organizationId }` (abrégé). */
function porte(texte: string, cle: string): boolean {
  return new RegExp(`\\b${cle}\\s*[:,}\\n]`).test(texte);
}

/** Le corps des `const X = { … }` du fichier, pour suivre `where: X`. */
function constantes(texte: string): Map<string, string> {
  const table = new Map<string, string>();
  const motif = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g;
  let trouve: RegExpExecArray | null;
  while ((trouve = motif.exec(texte))) {
    const debut = motif.lastIndex - 1;
    table.set(trouve[1], texte.slice(debut, finDuBloc(texte, debut, "{", "}") + 1));
  }
  return table;
}

const motifAppel = new RegExp(
  `\\bprisma(HorsPortee)?\\.(${Object.keys(MODELES).join("|")})\\.(${OPERATIONS.join("|")})\\s*\\(`,
  "g",
);

let portees = 0;
let horsPortee = 0;
const suspects: string[] = [];

for (const fichier of fichiers("src")) {
  const texte = readFileSync(fichier, "utf8");
  const consts = constantes(texte);
  motifAppel.lastIndex = 0;

  let trouve: RegExpExecArray | null;
  while ((trouve = motifAppel.exec(texte))) {
    const [entier, echappatoire, modele, operation] = trouve;

    if (echappatoire) {
      horsPortee++;
      continue;
    }

    const debut = trouve.index + entier.length - 1;
    let appel = texte.slice(debut, finDuBloc(texte, debut, "(", ")") + 1);

    for (const [nom, corps] of consts) {
      if (new RegExp(`\\b${nom}\\b`).test(appel)) appel += "\n" + corps;
    }

    if (porte(appel, MODELES[modele])) {
      portees++;
      continue;
    }

    const ligne = texte.slice(0, trouve.index).split("\n").length;
    suspects.push(
      `${fichier}:${ligne}  ${modele}.${operation}() — pas de « ${MODELES[modele]} »`,
    );
  }
}

for (const suspect of suspects) console.log(`⚠ ${suspect}`);

console.log(
  `\n${portees} requête(s) portée(s) · ${horsPortee} hors portée assumée(s) · ${suspects.length} à examiner`,
);

if (suspects.length > 0) process.exitCode = 1;
