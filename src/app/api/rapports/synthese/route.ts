import { NextRequest } from "next/server";
import { capitaliser, formatFCFA, formatMois } from "@/lib/format";
import { dansLeJournal } from "@/lib/journal";
import { MOYENS_PAIEMENT } from "@/lib/paiement";
import { ConstructeurPdf } from "@/lib/pdf";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resoudrePeriodeMois } from "@/lib/rapports";
import { requireSession } from "@/lib/session";
import { PaymentMethod } from "@/generated/prisma/enums";

/** Synthèse mensuelle PDF (PROJET.md §4.4) : total, évolution, répartitions. */
export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!can(session.role, "exports:generate")) {
    return new Response("Interdit", { status: 403 });
  }

  const periode = resoudrePeriodeMois(
    request.nextUrl.searchParams.get("mois") ?? undefined,
  );
  // Le mois précédent finit exactement où le courant commence.
  const debutPrecedent = new Date(
    periode.debut.getFullYear(),
    periode.debut.getMonth() - 1,
    1,
  );

  const perimetre = { organizationId: session.organizationId, ...dansLeJournal() };

  const [depenses, depensesPrecedentes] = await Promise.all([
    prisma.expense.findMany({
      where: { ...perimetre, date: { gte: periode.debut, lt: periode.fin } },
      select: {
        amount: true,
        paymentMethod: true,
        category: { select: { name: true, codeSyscohada: true } },
      },
    }),
    prisma.expense.aggregate({
      where: { ...perimetre, date: { gte: debutPrecedent, lt: periode.debut } },
      _sum: { amount: true },
    }),
  ]);

  const total = depenses.reduce((somme, d) => somme + d.amount, 0);
  const totalPrecedent = depensesPrecedentes._sum.amount ?? 0;
  const evolutionPourcent =
    totalPrecedent > 0 ? Math.round(((total - totalPrecedent) / totalPrecedent) * 100) : null;

  const parCategorie = new Map<string, { code: string | null; montant: number }>();
  for (const depense of depenses) {
    const cle = depense.category.name;
    const existant = parCategorie.get(cle);
    parCategorie.set(cle, {
      code: depense.category.codeSyscohada,
      montant: (existant?.montant ?? 0) + depense.amount,
    });
  }
  const categoriesTriees = [...parCategorie.entries()].sort(
    (a, b) => b[1].montant - a[1].montant,
  );

  const parMoyen = new Map<PaymentMethod, number>();
  for (const depense of depenses) {
    parMoyen.set(depense.paymentMethod, (parMoyen.get(depense.paymentMethod) ?? 0) + depense.amount);
  }

  const pdf = await ConstructeurPdf.creer(`Synthèse mensuelle — ${periode.param}`);
  pdf.titre("Synthèse mensuelle");
  pdf.sousTitre(
    `${session.organizationName} · ${capitaliser(formatMois(periode.debut))}`,
  );

  pdf.section("Vue d'ensemble");
  pdf.ligne("Total dépensé", formatFCFA(total), { gras: true });
  pdf.ligne(
    "Évolution vs mois précédent",
    evolutionPourcent === null ? "—" : `${evolutionPourcent > 0 ? "+" : ""}${evolutionPourcent} %`,
  );
  pdf.ligne("Nombre de dépenses", String(depenses.length));

  pdf.section("Répartition par catégorie");
  if (categoriesTriees.length === 0) {
    pdf.ligne("Aucune dépense sur la période", "");
  }
  for (const [nom, { code, montant }] of categoriesTriees) {
    pdf.ligne(`${code ? `${code} · ` : ""}${nom}`, formatFCFA(montant));
  }

  pdf.section("Répartition par moyen de paiement");
  if (parMoyen.size === 0) {
    pdf.ligne("Aucune dépense sur la période", "");
  }
  for (const [moyen, montant] of parMoyen.entries()) {
    pdf.ligne(MOYENS_PAIEMENT[moyen].libelle, formatFCFA(montant));
  }

  const tampon = await pdf.terminer();

  return new Response(new Uint8Array(tampon), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="synthese-${periode.param}.pdf"`,
    },
  });
}
