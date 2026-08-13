import type { NextRequest } from "next/server";
import { purgerOrganisationsExpirees } from "@/lib/purge";

/**
 * Purge quotidienne des entreprises dont le délai de grâce est écoulé.
 *
 * Route publique et destructrice : le secret partagé est la seule protection.
 * Vercel Cron envoie `Authorization: Bearer $CRON_SECRET` (voir vercel.json).
 * Sans CRON_SECRET configuré, la route refuse de s'exécuter plutôt que de
 * s'ouvrir à tous.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET non configuré", { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorisé", { status: 401 });
  }

  const purgees = await purgerOrganisationsExpirees();

  return Response.json({
    purgees: purgees.length,
    entreprises: purgees.map((o) => o.name),
  });
}
