import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { creerUrlSigneeJustificatif } from "@/lib/storage";

/**
 * Ouvre le justificatif d'une dépense.
 *
 * Le bucket étant privé, ce détour par le serveur est le seul chemin vers le
 * fichier : on vérifie ici que la dépense appartient bien à l'entreprise de
 * la session et que le rôle permet de la voir, puis on redirige vers une URL
 * signée à durée limitée (PROJET.md §10). Un lien direct vers le bucket
 * n'existe nulle part.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;

  const depense = await prisma.expense.findFirst({
    // Filtrer par organizationId fait partie du contrôle d'accès : une
    // dépense d'une autre entreprise doit être introuvable, pas interdite.
    where: { id, organizationId: session.organizationId },
    select: {
      createdById: true,
      receipts: { select: { fileUrl: true }, take: 1 },
    },
  });

  // 404 dans tous les cas de refus : ne pas révéler qu'une dépense existe
  // à qui n'a pas le droit de la voir.
  const peutVoir =
    depense &&
    (can(session.role, "expenses:read:all") ||
      depense.createdById === session.userId);
  if (!peutVoir || depense.receipts.length === 0) {
    return new Response("Justificatif introuvable", { status: 404 });
  }

  redirect(await creerUrlSigneeJustificatif(depense.receipts[0].fileUrl));
}
