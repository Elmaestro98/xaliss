-- ============================================================
-- Les policies d'isolation.
--
-- ⚠️ NE PAS APPLIQUER avant que l'application ne pose la variable de session
-- (voir README.md, étape 4). Une fois ces policies actives, une requête qui
-- n'a pas posé `app.organization_id` renvoie ZÉRO ligne — l'application
-- semblera vide plutôt que cassée, ce qui est bien pire à diagnostiquer.
--
-- `current_setting(…, true)` renvoie NULL si la variable n'a jamais été posée,
-- et `colonne = NULL` n'est jamais vrai : l'absence de contexte refuse tout.
--
-- Nuance constatée le 16 août 2026 sur le pooler Supabase : une connexion qui a
-- DÉJÀ servi une requête portée ne revient pas à NULL en fin de transaction,
-- elle revient à la CHAÎNE VIDE. Le refus tient quand même — aucun
-- organizationId ne vaut '' — mais il ne faut pas compter sur `IS NULL` pour
-- détecter l'absence de contexte. Dans les deux cas : on ferme, on n'ouvre pas.
-- ============================================================

-- ── Les dix tables qui portent organizationId ───────────────
-- `Approval` n'en fait PAS partie, contrairement à ce que ce fichier a cru
-- jusqu'au 16 août 2026 : la colonne n'existe pas dans son modèle, et la
-- boucle ci-dessous échouait donc en bloc sur « column organizationId does not
-- exist ». Elle est traitée plus bas, avec Receipt, par une policy qui remonte
-- la relation.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'Membership', 'Category', 'Expense', 'RecurringExpense', 'Budget',
    'ExpenseReport', 'Subscription', 'Payment', 'OcrUsage',
    'AuditLog'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    -- FORCE : sans lui, le propriétaire des tables (postgres) continuerait de
    -- passer au travers. C'est la ligne qui empêche le RLS d'être décoratif.
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS isolation_entreprise ON %I', t);
    EXECUTE format(
      'CREATE POLICY isolation_entreprise ON %I
         USING ("organizationId" = current_setting(''app.organization_id'', true))
         WITH CHECK ("organizationId" = current_setting(''app.organization_id'', true))',
      t
    );
  END LOOP;
END
$$;

-- ── Organization : son propre id EST l'identifiant d'entreprise ──
-- (PROJET.md §6, décisions d'architecture phase 2 : Organization.id = org_xxx
-- de Clerk, pas un cuid.)
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolation_entreprise ON "Organization";
CREATE POLICY isolation_entreprise ON "Organization"
  USING (id = current_setting('app.organization_id', true))
  WITH CHECK (id = current_setting('app.organization_id', true));

-- ── Receipt : la seule table sans organizationId ─────────────
-- Un justificatif appartient à une dépense, et tient sa portée d'elle. Ajouter
-- une colonne `organizationId` ici dupliquerait une information déjà connue,
-- et deux copies d'une même vérité finissent toujours par diverger.
ALTER TABLE "Receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Receipt" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolation_entreprise ON "Receipt";
CREATE POLICY isolation_entreprise ON "Receipt"
  USING (
    EXISTS (
      SELECT 1 FROM "Expense" e
      WHERE e.id = "Receipt"."expenseId"
        AND e."organizationId" = current_setting('app.organization_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Expense" e
      WHERE e.id = "Receipt"."expenseId"
        AND e."organizationId" = current_setting('app.organization_id', true)
    )
  );

-- ── Approval : la seconde table sans organizationId ──────────
-- Une décision d'approbation appartient à une note de frais, et tient sa
-- portée d'elle — même raisonnement que Receipt ci-dessus.
ALTER TABLE "Approval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Approval" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolation_entreprise ON "Approval";
CREATE POLICY isolation_entreprise ON "Approval"
  USING (
    EXISTS (
      SELECT 1 FROM "ExpenseReport" r
      WHERE r.id = "Approval"."reportId"
        AND r."organizationId" = current_setting('app.organization_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "ExpenseReport" r
      WHERE r.id = "Approval"."reportId"
        AND r."organizationId" = current_setting('app.organization_id', true)
    )
  );

-- ── Vérification ─────────────────────────────────────────────
-- Les 13 tables doivent apparaître avec relrowsecurity ET relforcerowsecurity
-- à true. Une seule à false, et l'isolation a un trou.
--
--   SELECT relname, relrowsecurity, relforcerowsecurity
--   FROM pg_class
--   WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
--   ORDER BY relname;
