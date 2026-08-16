-- Bammite devient le prestataire d'encaissement des abonnements (PROJET.md
-- section 9). Il revend PayDunya : la page de paiement ouverte est une facture
-- PayDunya, mais Xaalis ne parle qu'a Bammite.
--
-- Purement additif. La valeur PAYDUNYA ajoutee par la migration precedente est
-- conservee : retirer une valeur d'enum PostgreSQL n'est pas supporte, et rien
-- ne justifie de reecrire la table pour une valeur inutilisee.

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'BAMMITE';
