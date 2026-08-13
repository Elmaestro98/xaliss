import { NextRequest } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { ReportStatus } from "@/generated/prisma/enums";
import { capitaliser, formatFCFA, formatMois } from "@/lib/format";
import { LIBELLE_STATUT_NOTE } from "@/lib/notes";
import { ConstructeurPdf } from "@/lib/pdf";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resoudrePeriodeMois } from "@/lib/rapports";
import { requireSession } from "@/lib/session";

/**
 * État des notes de frais par employé (PROJET.md §4.4) : pour chaque employé
 * ayant créé au moins une note dans le mois choisi, le détail par statut.
 */
export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!can(session.role, "exports:generate")) {
    return new Response("Interdit", { status: 403 });
  }

  const periode = resoudrePeriodeMois(
    request.nextUrl.searchParams.get("mois") ?? undefined,
  );

  const groupes = await prisma.expenseReport.groupBy({
    by: ["employeeId", "status"],
    where: {
      organizationId: session.organizationId,
      createdAt: { gte: periode.debut, lt: periode.fin },
    },
    _sum: { totalAmount: true },
    _count: true,
  });

  const parEmploye = new Map<
    string,
    Partial<Record<ReportStatus, { nombre: number; montant: number }>>
  >();
  for (const groupe of groupes) {
    const statuts = parEmploye.get(groupe.employeeId) ?? {};
    statuts[groupe.status] = {
      nombre: groupe._count,
      montant: groupe._sum.totalAmount ?? 0,
    };
    parEmploye.set(groupe.employeeId, statuts);
  }

  const client = await clerkClient();
  const { data: utilisateurs } = await client.users.getUserList({
    userId: [...parEmploye.keys()],
    limit: 100,
  });
  const noms = new Map(
    utilisateurs.map((u) => [
      u.id,
      [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "—",
    ]),
  );

  const employesTries = [...parEmploye.entries()].sort((a, b) =>
    (noms.get(a[0]) ?? "").localeCompare(noms.get(b[0]) ?? ""),
  );

  const pdf = await ConstructeurPdf.creer(`État des notes de frais — ${periode.param}`);
  pdf.titre("État des notes de frais par employé");
  pdf.sousTitre(
    `${session.organizationName} · ${capitaliser(formatMois(periode.debut))}`,
  );

  if (employesTries.length === 0) {
    pdf.espace();
    pdf.ligne("Aucune note de frais créée sur la période", "");
  }

  for (const [employeeId, statuts] of employesTries) {
    pdf.section(noms.get(employeeId) ?? "—");
    let totalEmploye = 0;
    for (const statut of Object.values(ReportStatus)) {
      const detail = statuts[statut];
      if (!detail) continue;
      totalEmploye += detail.montant;
      pdf.ligne(
        `${LIBELLE_STATUT_NOTE[statut]} (${detail.nombre})`,
        formatFCFA(detail.montant),
      );
    }
    pdf.ligne("Total", formatFCFA(totalEmploye), { gras: true });
  }

  const tampon = await pdf.terminer();

  return new Response(new Uint8Array(tampon), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="notes-de-frais-${periode.param}.pdf"`,
    },
  });
}
