import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import {
  marquerOrganisationSupprimee,
  retirerAdhesion,
  synchroniserAdhesion,
  synchroniserOrganisation,
} from "@/lib/sync-clerk";

/**
 * Miroir temps réel de Clerk vers notre base.
 *
 * Cette route est publique : c'est Clerk qui l'appelle, sans session. La
 * signature est donc la SEULE preuve que l'appel vient bien de Clerk —
 * `verifyWebhook` la vérifie avec CLERK_WEBHOOK_SIGNING_SECRET et lève si
 * elle ne correspond pas. Sans cela, n'importe qui pourrait faire supprimer
 * une entreprise avec une simple requête HTTP.
 */
export async function POST(request: NextRequest) {
  let evenement;
  try {
    evenement = await verifyWebhook(request);
  } catch {
    // Volontairement avare en détails : ne pas aider qui sonde la route.
    return new Response("Signature invalide", { status: 400 });
  }

  switch (evenement.type) {
    case "organization.created":
    case "organization.updated": {
      await synchroniserOrganisation({
        id: evenement.data.id,
        name: evenement.data.name,
        logo: evenement.data.image_url,
      });
      break;
    }

    case "organization.deleted": {
      // Délai de grâce : on pose la date, la purge efface 30 jours plus tard.
      if (evenement.data.id) {
        await marquerOrganisationSupprimee(evenement.data.id);
      }
      break;
    }

    case "organizationMembership.created": {
      await synchroniserOrganisation({
        id: evenement.data.organization.id,
        name: evenement.data.organization.name,
        logo: evenement.data.organization.image_url,
      });
      await synchroniserAdhesion({
        userId: evenement.data.public_user_data.user_id,
        organizationId: evenement.data.organization.id,
        clerkOrgRole: evenement.data.role,
      });
      break;
    }

    case "organizationMembership.deleted": {
      await retirerAdhesion({
        userId: evenement.data.public_user_data.user_id,
        organizationId: evenement.data.organization.id,
      });
      break;
    }

    // organizationMembership.updated est ignoré volontairement : le rôle Clerk
    // ne sert qu'à l'amorçage, c'est Membership.role qui fait foi (PROJET.md §6).
    default:
      break;
  }

  // 200 même sur un événement ignoré : un non-2xx déclencherait des tentatives
  // de renvoi par Clerk pour un message qu'on a bien reçu et volontairement
  // laissé passer.
  return new Response("OK", { status: 200 });
}
