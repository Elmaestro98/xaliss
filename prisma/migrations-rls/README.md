# RLS PostgreSQL — écrit, pas encore appliqué

Ce dossier est **volontairement hors de `prisma/migrations/`** : `prisma migrate`
ne doit pas l'appliquer tout seul. Le RLS change le rôle de connexion de
l'application ; l'activer par accident coupe l'accès à la base.

## Pourquoi il n'est pas actif aujourd'hui

Trois constats, dans l'ordre où ils bloquent :

1. **L'application se connecte en `postgres`**, le rôle propriétaire des tables.
   PostgreSQL laisse un propriétaire ignorer ses propres policies. Les écrire
   sans changer de rôle ne protégerait rien.

2. **`auth.jwt()->>'org_id'` ne peut pas marcher ici.** Cette fonction est un
   outil de Supabase qui lit un jeton envoyé à chaque requête HTTP. Prisma
   ouvre une connexion PostgreSQL directe, sans jeton : elle renverrait `NULL`
   à chaque appel. C'est pourquoi les policies ci-dessous s'appuient sur
   `current_setting('app.organization_id')`, une variable de session que
   l'application doit poser elle-même.

3. **Poser cette variable coûte une instruction par requête.** Chaque requête
   doit devenir une transaction :

   ```sql
   BEGIN;
   SELECT set_config('app.organization_id', 'org_3Gh…', true);
   SELECT … FROM "Expense";
   COMMIT;
   ```

   Côté Prisma, cela veut dire envelopper chaque opération — un changement qui
   touche toute l'application et double les allers-retours réseau.

En attendant, c'est la **garde de portée applicative** (`src/lib/prisma.ts`)
qui tient le rôle : elle refuse toute requête multi-lignes non filtrée par
`organizationId`. Elle protège de l'oubli d'un développeur, pas d'une
application compromise. Voir PROJET.md §10.

## Pour activer

1. Créer le rôle et lui donner ses droits (`01-role-application.sql`), avec un
   vrai mot de passe.
2. Basculer `DATABASE_URL` sur ce rôle — **pas** sur `postgres`.
3. Appliquer `02-policies.sql`.
4. Envelopper les requêtes Prisma dans une transaction qui appelle
   `set_config`. Sans cette étape, **toutes les requêtes renverront zéro
   ligne** : la variable étant absente, aucune ligne ne satisfait la policy.

L'ordre compte. Appliquer l'étape 3 avant la 4 coupe l'application.

## Ce que le RLS apporterait en plus de la garde actuelle

| | Garde applicative | RLS PostgreSQL |
| --- | --- | --- |
| Filtre oublié par un développeur | ✅ | ✅ |
| Écriture par identifiant non vérifiée | ❌ | ✅ |
| Injection SQL | ❌ | ✅ |
| Requête lancée hors de l'application (psql, Studio) | ❌ | ✅ |
| Coût | nul | +1 aller-retour par requête |
