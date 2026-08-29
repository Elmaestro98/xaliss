import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/* ------------------------------------------------------------------ */
/* DEUX CONNEXIONS, DEUX RÔLES POSTGRESQL                               */
/*                                                                      */
/* Le RLS ne se contourne pas depuis l'application : il se contourne au  */
/* niveau du RÔLE de connexion. Un rôle `BYPASSRLS` traverse toutes les  */
/* policies sans en déclencher une seule ; un rôle ordinaire les subit.  */
/* D'où deux clients, et non un seul avec un drapeau :                   */
/*                                                                      */
/*   prisma           → DATABASE_URL       → xaalis_app (RLS appliqué)   */
/*   prismaHorsPortee → DATABASE_URL_ADMIN → postgres   (BYPASSRLS)      */
/*                                                                      */
/* ⚠️ Tant que `DATABASE_URL` pointe encore sur `postgres`, les deux     */
/* sont équivalents et RIEN ne change. La bascule est l'étape 5 du       */
/* prisma/migrations-rls/README.md. Ce fichier est prêt avant elle,      */
/* volontairement : changer le rôle ET le code le même jour ferait qu'une*/
/* panne ne dirait plus lequel des deux l'a causée.                     */
/* ------------------------------------------------------------------ */

const urlApplication = process.env.DATABASE_URL;
const urlTransverse = process.env.DATABASE_URL_ADMIN ?? urlApplication;

const globalForPrisma = globalThis as unknown as {
  prismaBrut: PrismaClient | undefined;
  prismaTransverse: PrismaClient | undefined;
};

/*
 * Le pool doit être plus large depuis le RLS, et la raison n'est pas le
 * nombre d'utilisateurs.
 *
 * Chaque requête portée est devenue une TRANSACTION (voir plus bas), et une
 * transaction retient sa connexion du début à la fin — là où une requête
 * simple la rendait aussitôt. Une page qui lance neuf requêtes en parallèle
 * réclame donc neuf connexions simultanées. Avec le défaut de `pg` (10), la
 * dixième attend, et `maxWait` la fait échouer sur « Unable to start a
 * transaction in the given time » — l'erreur constatée le 16 août 2026.
 *
 * Le pooler Supabase encaisse largement ces connexions : c'est son métier.
 */
const TAILLE_POOL = 25;

/*
 * `maxWait` généreux, et c'est de la latence, pas de la charge.
 *
 * Une transaction portée coûte quatre allers-retours (BEGIN, set_config, la
 * requête, COMMIT) au lieu d'un. Sur un lien lent — un poste sénégalais qui
 * parle à Francfort — cela se compte en centaines de millisecondes, et les
 * deux secondes par défaut sont dépassées par la simple mise en file. En
 * production, application et base partagées dans la même région, le même
 * calcul devient négligeable ; ce réglage est là pour que le développement
 * reste utilisable, pas pour masquer une lenteur de production.
 */
const OPTIONS_TRANSACTION = { maxWait: 15_000, timeout: 30_000 };

const brut =
  globalForPrisma.prismaBrut ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: urlApplication,
      max: TAILLE_POOL,
    }),
    transactionOptions: OPTIONS_TRANSACTION,
  });

/*
 * Un seul client quand les deux URL sont identiques.
 *
 * Le repli sur `DATABASE_URL` n'est pas de la complaisance : un
 * environnement qui n'a pas encore la nouvelle variable — Vercel le jour du
 * déploiement, une CI — doit démarrer normalement plutôt que d'ouvrir une
 * connexion `undefined` dont l'erreur ne tomberait qu'à la première requête.
 * Et tant qu'elles se valent, ouvrir deux pools de connexions vers la même
 * base serait payer deux fois pour la même chose.
 */
const brutTransverse =
  urlTransverse === urlApplication
    ? brut
    : (globalForPrisma.prismaTransverse ??
      new PrismaClient({
        adapter: new PrismaPg({
          connectionString: urlTransverse,
          max: TAILLE_POOL,
        }),
        transactionOptions: OPTIONS_TRANSACTION,
      }));

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBrut = brut;
  globalForPrisma.prismaTransverse = brutTransverse;
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
 * `Receipt` et `Approval` en sont absents, et c'est voulu : ce sont les deux
 * modèles d'entreprise qui ne portent PAS `organizationId`. Un justificatif se
 * rattache à une dépense, une décision d'approbation à une note de frais ;
 * tous deux tiennent leur portée de leur parent. Les garder ici obligerait à
 * exiger un filtre qui n'existe pas dans le schéma — Prisma refuserait la
 * requête avec « Unknown argument organizationId ».
 *
 * Côté base, ils sont couverts autrement : leur policy RLS remonte la relation
 * (voir prisma/migrations-rls/02-policies.sql).
 */
const MODELES_GARDES = new Set([
  "Organization",
  "Membership",
  "Category",
  "Expense",
  "RecurringExpense",
  "Budget",
  "ExpenseReport",
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

/* ------------------------------------------------------------------ */
/* LE CONTEXTE D'ENTREPRISE, CÔTÉ BASE                                  */
/*                                                                      */
/* Les policies RLS lisent `current_setting('app.organization_id')`     */
/* (prisma/migrations-rls/02-policies.sql). Cette variable n'existe pas  */
/* toute seule : c'est à l'application de la poser, dans la MÊME         */
/* transaction que la requête — une variable posée sur une autre         */
/* connexion du pooler ne servirait à rien.                             */
/*                                                                      */
/* ⚠️ La variable absente ne provoque pas d'erreur côté PostgreSQL :     */
/* `current_setting(…, true)` renvoie NULL, `colonne = NULL` n'est jamais*/
/* vrai, et la requête ressort avec ZÉRO ligne. Une application qui      */
/* semble vide est bien plus dure à diagnostiquer qu'une application qui */
/* plante — d'où le refus explicite plus bas quand la portée est         */
/* introuvable. Même parti pris que la garde ci-dessus : bruyant plutôt  */
/* que silencieux.                                                      */
/* ------------------------------------------------------------------ */

/**
 * La portée en cours, propagée à travers les appels asynchrones.
 *
 * Sert à un seul cas, mais il est indispensable : à l'intérieur d'une
 * transaction, la variable de session est déjà posée pour toute la durée de
 * celle-ci. Sans ce drapeau, chaque requête de la transaction essaierait
 * d'ouvrir sa propre sous-transaction pour la reposer — ce que PostgreSQL
 * refuse. Voir `transactionPortee()`.
 */
const contextePortee = new AsyncLocalStorage<{
  organizationId: string;
  dejaPosee: boolean;
}>();

/**
 * L'entreprise de la requête HTTP en cours, d'après Clerk.
 *
 * Lue chez Clerk et NON dans notre base, et ce n'est pas un détail : résoudre
 * la session demande une requête Prisma (`lib/session.ts`), qui repasserait
 * ici, qui redemanderait la session… La boucle serait infinie.
 *
 * L'import est dynamique pour que ce module reste utilisable hors de Next.js —
 * les scripts de `scripts/` l'importent, et `@clerk/nextjs/server` n'y a rien
 * à faire. Hors requête HTTP, `auth()` lève : on renvoie null, et l'appelant
 * décidera si c'est acceptable.
 */
async function organisationCourante(): Promise<string | null> {
  try {
    const { auth } = await import("@clerk/nextjs/server");
    const { orgId } = await auth();
    return orgId ?? null;
  } catch {
    return null;
  }
}

/**
 * Construit un client porté : garde applicative + variable de session RLS.
 *
 * Le résolveur dit de quelle entreprise il s'agit. Deux implémentations
 * seulement — Clerk pour les pages et actions serveur, une valeur fixe pour
 * `prismaPourOrg()`.
 */
function construireClientPorte(resolveur: () => Promise<string | null>) {
  return brut.$extends({
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

          // Déjà dans une transaction portée : la variable y est posée, et
          // rouvrir une transaction ici échouerait.
          const contexte = contextePortee.getStore();
          if (contexte?.dejaPosee) return query(args);

          const organizationId = contexte?.organizationId ?? (await resolveur());
          if (!organizationId) {
            throw new Error(
              `Portée RLS introuvable : ${model}.${operation}() sans entreprise ` +
                `courante. Cette requête ne renverrait aucune ligne une fois les ` +
                `policies actives. Depuis une page ou une action serveur, la ` +
                `session Clerk suffit ; depuis un cron, un webhook ou une route ` +
                `sans session, utilisez prismaPourOrg(organizationId) — ou ` +
                `prismaHorsPortee si la requête est réellement transverse.`,
            );
          }

          /*
           * Les deux instructions doivent partir sur la MÊME connexion, sinon
           * la variable est posée dans le vide : le pooler Supabase peut
           * servir chaque requête depuis une connexion différente. Le lot
           * transactionnel de Prisma le garantit, et le troisième argument
           * `true` de set_config limite la variable à la transaction — elle
           * ne fuite donc pas vers la requête suivante d'un autre client.
           */
          const [, resultat] = await brut.$transaction([
            brut.$executeRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`,
            query(args) as ReturnType<typeof brut.$executeRaw>,
          ]);
          return resultat;
        },
      },
    },
  });
}

/**
 * Le client porté — celui qu'utilise tout le reste de l'application.
 *
 * L'entreprise vient de la session Clerk : rien à passer, rien à oublier.
 */
export const prisma = construireClientPorte(organisationCourante);

/**
 * Le client porté sur une entreprise nommée, pour le code SANS session Clerk :
 * webhook, crons, routes protégées par un secret.
 *
 * Ce n'est pas une échappatoire — la portée est toujours là, elle est
 * simplement dite à la main parce qu'aucune session ne peut la dire.
 */
export function prismaPourOrg(organizationId: string) {
  // Mémoïsé : `$extends` reconstruit tout un client à chaque appel, et cette
  // fonction est appelée dans le chemin le plus fréquenté de l'application.
  // Le cache est borné par le nombre d'entreprises, qui est petit et connu —
  // rien à expirer.
  const dejaConstruit = clientsParOrg.get(organizationId);
  if (dejaConstruit) return dejaConstruit;

  const client = construireClientPorte(async () => organizationId);
  clientsParOrg.set(organizationId, client);
  return client;
}

const clientsParOrg = new Map<
  string,
  ReturnType<typeof construireClientPorte>
>();

/**
 * Une transaction portée sur une entreprise.
 *
 * À utiliser partout où le code appelait `prisma.$transaction()`. La variable
 * de session est posée UNE fois, en tête, et vaut pour toute la transaction :
 * c'est plus économe que de la reposer à chaque requête, et surtout c'est la
 * seule façon qui marche — PostgreSQL refuse une transaction dans une
 * transaction.
 *
 * Le `tx` reçu garde la garde applicative : oublier `organizationId` dans un
 * where y est refusé comme ailleurs.
 */
export function transactionPortee<T>(
  organizationId: string,
  fn: (tx: Omit<typeof prisma, `$${string}`>) => Promise<T>,
): Promise<T> {
  return contextePortee.run({ organizationId, dejaPosee: true }, () =>
    prisma.$transaction(async (tx) => {
      // En tête, avant toute lecture : une requête qui partirait avant ce
      // set_config ne verrait rien.
      await tx.$executeRaw`SELECT set_config('app.organization_id', ${organizationId}, true)`;
      return fn(tx);
    }),
  );
}

/**
 * Le client SANS garde, pour les requêtes légitimement transverses.
 *
 * Le nom est volontairement pénible à écrire et facile à chercher : à tout
 * moment, `grep prismaHorsPortee src/` donne la liste exhaustive des endroits
 * où Xaalis regarde par-dessus la cloison entre deux entreprises. C'est cette
 * liste qu'un audit doit relire — pas les six cents autres requêtes.
 *
 * Toute utilisation doit être justifiée par un commentaire.
 *
 * ⚠️ Il ne lève plus seulement la garde applicative : une fois le RLS actif,
 * il passe par un rôle `BYPASSRLS` et lève donc AUSSI la protection de la base.
 * C'est le seul endroit du code capable de lire les données de toutes les
 * entreprises, et c'est ce qui rend la liste ci-dessus si importante.
 */
export const prismaHorsPortee = brutTransverse;
