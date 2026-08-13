import type { NextRequest } from "next/server";
import { genererDepensesEchues } from "@/lib/recurrentes";

/**
 * Génération quotidienne des dépenses récurrentes arrivées à échéance.
 *
 * Route publique qui écrit dans le journal : le secret partagé est la seule
 * protection, même contrat que /api/cron/purge. Vercel Cron envoie
 * `Authorization: Bearer $CRON_SECRET` (voir vercel.json).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET non configuré", { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorisé", { status: 401 });
  }

  return Response.json(await genererDepensesEchues());
}
