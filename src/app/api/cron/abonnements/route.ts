import type { NextRequest } from "next/server";
import { traiterEcheances } from "@/lib/echeances";

/**
 * Passage quotidien sur les échéances d'abonnement (PROJET.md §9).
 *
 * Même protection que /api/cron/purge : Vercel Cron envoie
 * `Authorization: Bearer $CRON_SECRET` (voir vercel.json). Sans secret
 * configuré, la route refuse de s'exécuter plutôt que de s'ouvrir à tous —
 * elle peut suspendre l'accès d'une entreprise.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET non configuré", { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Non autorisé", { status: 401 });
  }

  const { impayes, suspendus } = await traiterEcheances();

  return Response.json({
    impayes: impayes.length,
    suspendus: suspendus.length,
    detail: { impayes, suspendus },
  });
}
