-- Passage de l'encaissement des abonnements a PayDunya (PROJET.md section 9).
--
-- Purement additif : aucune colonne supprimee, aucune donnee reecrite. Les
-- paiements Wave deja enregistres restent lisibles tels quels, avec leurs deux
-- nouvelles colonnes a NULL.

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'PAYDUNYA';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "providerCheckoutUrl" TEXT,
ADD COLUMN     "providerInvoiceToken" TEXT;

-- CreateIndex
-- Sans danger sur l'existant : PostgreSQL n'applique pas l'unicite aux NULL,
-- et toutes les lignes anterieures a PayDunya ont ce token a NULL.
CREATE UNIQUE INDEX "Payment_providerInvoiceToken_key" ON "Payment"("providerInvoiceToken");
