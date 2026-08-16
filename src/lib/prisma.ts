import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = globalThis as unknown as {
  prismaBrut: PrismaClient | undefined;
};

const brut = globalForPrisma.prismaBrut ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBrut = brut;
}

/* ------------------------------------------------------------------ */
/* LA GARDE DE PORTÉE                                                   */
/*                                                                      */
/* Xaalis est multi-entreprises : chaque ligne appartient à une PME et   */
/* ne doit jamais être lue par une autre. Aujourd'hui c'est le code      */
/* applicatif qui le garantit, en écrivant `organizationId` dans chaque  */
/* requête. Ça marche — tant que personne n'oublie.                     */
/*                                                                      */
/* Cette garde transforme cet oubli en erreur immédiate et bruyante,     */
/* plutôt qu'en fuite silencieuse découverte par un client.             */
/*                                                                      */
/* ⚠️ CE QU'ELLE NE FAIT PAS. Ce n'est PAS du RLS. Elle protège de       */
/* l'erreur du développeur, pas d'une application compromise ni d'une    */
/* injection SQL : tout se passe côté Node, la base fait toujours        */
/* confiance à ce qu'on lui envoie. Le vrai RLS PostgreSQL est écrit     */
/* dans prisma/migrations-rls/, prêt à être appliqué le jour où un rôle  */
/* de base dédié sera créé. Voir PROJET.md §10.                         */
/* ------------------------------------------------------------------ */

/**
 * Les modèles à garder.
 *
 * `Receipt` en est absent, et c'est voulu : c'est le seul modèle d'entreprise
 * qui ne porte PAS `organizationId` — il se rattache à une dépense, et sa
 * portée vient d'elle. Le garder ici obligerait à inventer un filtre qui
 * n'existe pas dans le schéma.
 */
const MODELES_GARDES = new Set([
  "Organization",
  "Membership",
  "Category",
  "Expense",
  "RecurringExpense",
  "Budget",
  "ExpenseReport",
  "Approval",
  "Subscription",
  "Payment",
  "OcrUsage",
  "AuditLog",
]);

/**
 * Les opérations qui peuvent toucher PLUSIEURS lignes — les seules gardées.
 *
 * `findUnique`, `update` et `delete` en sont volontairement exclues, et pas
 * par négligence : Prisma n'accepte dans leur `where` que des champs UNIQUES.
 * Écrire `update({ where: { id, organizationId } })` est structurellement
 * impossible. D'où le motif employé partout dans l'application — d'abord
 * `findFirst({ where: { id, organizationId } })` pour vérifier
 * l'appartenance, puis `update({ where: { id } })` sur la ligne obtenue.
 *
 * La conséquence à connaître : une écriture par identifiant reste sous la
 * responsabilité de son appelant. C'est aussi ce que le RLS, lui, couvrirait.
 */
const OPERATIONS_MULTILIGNES = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

/**
 * La clé de portée est-elle réellement contraignante dans ce `where` ?
 *
 * On ne se contente pas de chercher le mot n'importe où : dans un `OR`, il
 * faut que CHAQUE branche porte la clé, sinon une seule branche non portée
 * ramène les lignes de tout le monde. Dans un `AND`, une branche suffit.
 * `NOT` ne compte jamais — il exclut, il ne restreint pas.
 */
function porteeContraignante(where: unknown, cle: string): boolean {
  if (!where || typeof where !== "object") return false;
  if (Array.isArray(where)) {
    return where.some((membre) => porteeContraignante(membre, cle));
  }

  const objet = where as Record<string, unknown>;

  if (objet[cle] !== undefined && objet[cle] !== null) return true;

  if (objet.AND !== undefined && porteeContraignante(objet.AND, cle)) {
    return true;
  }

  if (Array.isArray(objet.OR)) {
    return (
      objet.OR.length > 0 &&
      objet.OR.every((branche) => porteeContraignante(branche, cle))
    );
  }

  return false;
}

/** Le client porté — celui qu'utilise tout le reste de l'application. */
export const prisma = brut.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (
          MODELES_GARDES.has(model) &&
          OPERATIONS_MULTILIGNES.has(operation)
        ) {
          // Organization ne porte pas `organizationId` : son propre `id` EST
          // l'identifiant d'entreprise (PROJET.md §6, décisions phase 2).
          const cle = model === "Organization" ? "id" : "organizationId";
          const where = (args as { where?: unknown } | undefined)?.where;

          if (!porteeContraignante(where, cle)) {
            throw new Error(
              `Portée manquante : ${model}.${operation}() sans filtre « ${cle} ». ` +
                `Cette requête renverrait les lignes de toutes les entreprises. ` +
                `Ajoutez ${cle} au where, ou — si la requête doit vraiment ` +
                `couvrir toutes les entreprises (cron, purge, console éditeur) — ` +
                `utilisez prismaHorsPortee en expliquant pourquoi en commentaire.`,
            );
          }
        }

        return query(args);
      },
    },
  },
});

/**
 * Le client SANS garde, pour les requêtes légitimement transverses.
 *
 * Le nom est volontairement pénible à écrire et facile à chercher : à tout
 * moment, `grep prismaHorsPortee src/` donne la liste exhaustive des endroits
 * où Xaalis regarde par-dessus la cloison entre deux entreprises. C'est cette
 * liste qu'un audit doit relire — pas les six cents autres requêtes.
 *
 * Toute utilisation doit être justifiée par un commentaire.
 */
export const prismaHorsPortee = brut;
