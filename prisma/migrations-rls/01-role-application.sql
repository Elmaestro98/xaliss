-- ============================================================
-- Le rôle de l'application.
--
-- Toute la protection tient à un fait : ce rôle ne possède PAS les tables.
-- Un propriétaire de table ignore ses propres policies — donner ce rôle à
-- `postgres` reviendrait à écrire des règles que personne n'applique.
--
-- À exécuter une fois, sur la connexion DIRECTE (pas le pooler), en tant que
-- `postgres`. Remplacer le mot de passe avant de lancer.
-- ============================================================

-- Ne pas relancer si le rôle existe déjà : ce fichier doit pouvoir être rejoué.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'xaalis_app') THEN
    CREATE ROLE xaalis_app LOGIN PASSWORD 'A_REMPLACER_AVANT_EXECUTION';
  END IF;
END
$$;

-- Il voit le schéma, mais ne peut rien y créer ni rien y détruire.
GRANT USAGE ON SCHEMA public TO xaalis_app;

-- Les quatre verbes du quotidien, et rien de plus : ni TRUNCATE, ni les
-- droits de structure. Une application de saisie comptable n'a aucune raison
-- de pouvoir vider une table d'un coup.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO xaalis_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO xaalis_app;

-- Les tables créées par les futures migrations doivent hériter des mêmes
-- droits, sinon la première migration qui ajoute une table casse l'accès.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO xaalis_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO xaalis_app;

-- Vérification : doit renvoyer false. Un rôle BYPASSRLS traverserait toutes
-- les policies sans en déclencher une seule.
-- SELECT rolbypassrls FROM pg_roles WHERE rolname = 'xaalis_app';
