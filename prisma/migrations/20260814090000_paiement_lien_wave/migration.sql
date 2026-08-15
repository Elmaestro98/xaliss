-- Passage de l'API Wave Checkout au lien de paiement Wave (PROJET.md section 9).
--
-- Xaalis n'ouvre plus de session de paiement et ne recoit plus de webhook
-- signe : l'entreprise paie sur un lien a montant libre, declare son versement,
-- et l'editeur l'encaisse apres l'avoir constate sur le portefeuille marchand.

-- L'etat intermediaire que ce parcours rend necessaire : le client a declare,
-- personne n'a encore verifie. Ne pas le confondre avec SUCCEEDED reviendrait a
-- activer un abonnement sur simple affirmation.
ALTER TYPE "PaymentStatus" ADD VALUE 'AWAITING_VERIFICATION' AFTER 'PENDING';

-- Plus de session de paiement cote prestataire : la colonne n'a plus d'objet.
ALTER TABLE "Payment" DROP COLUMN "providerSessionId";

-- Registre d'idempotence des webhooks : sans webhook, il ne protege plus rien.
DROP TABLE "WebhookEvent";
