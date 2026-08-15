import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { AbonnementError, assertFonctionnalite, etatCourant } from "@/lib/abonnement";
import { dansLeJournal } from "@/lib/journal";
import { MOYENS_PAIEMENT } from "@/lib/paiement";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resoudrePeriodeMois } from "@/lib/rapports";
import { requireSession } from "@/lib/session";

/**
 * Export Excel du journal des dépenses (PROJET.md §4.4) — une ligne par
 * dépense qui a effectivement intégré le journal de l'entreprise (donc pas une
 * note de frais encore en attente de remboursement, voir lib/journal.ts).
 */
export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (!can(session.role, "exports:generate")) {
    return new Response("Interdit", { status: 403 });
  }

  // Excel est réservé aux plans Pro et Business (PROJET.md §11) ; l'export PDF
  // reste ouvert à tous, y compris en abonnement suspendu — on ne retient pas
  // en otage la comptabilité d'un client qui s'en va.
  try {
    const etat = await etatCourant(session.organizationId);
    assertFonctionnalite(etat.plan, "export-excel");
  } catch (erreur) {
    if (erreur instanceof AbonnementError) {
      return new Response(erreur.message, { status: 402 });
    }
    throw erreur;
  }

  const periode = resoudrePeriodeMois(
    request.nextUrl.searchParams.get("mois") ?? undefined,
  );

  const depenses = await prisma.expense.findMany({
    where: {
      organizationId: session.organizationId,
      date: { gte: periode.debut, lt: periode.fin },
      ...dansLeJournal(),
    },
    orderBy: { date: "asc" },
    select: {
      date: true,
      amount: true,
      supplier: true,
      description: true,
      paymentMethod: true,
      createdById: true,
      category: { select: { name: true, codeSyscohada: true } },
    },
  });

  // Les noms vivent chez Clerk, pas en base (PROJET.md §7).
  const client = await clerkClient();
  const { data: utilisateurs } = await client.users.getUserList({
    userId: [...new Set(depenses.map((d) => d.createdById))],
    limit: 100,
  });
  const noms = new Map(
    utilisateurs.map((u) => [
      u.id,
      [u.firstName, u.lastName].filter(Boolean).join(" ") ||
        u.username ||
        "—",
    ]),
  );

  const classeur = new ExcelJS.Workbook();
  classeur.creator = "Xaalis";
  classeur.created = new Date();

  const feuille = classeur.addWorksheet("Journal des dépenses");
  feuille.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Code SYSCOHADA", key: "code", width: 16 },
    { header: "Catégorie", key: "categorie", width: 24 },
    { header: "Fournisseur", key: "fournisseur", width: 22 },
    { header: "Description", key: "description", width: 30 },
    { header: "Moyen de paiement", key: "moyen", width: 18 },
    { header: "Saisie par", key: "auteur", width: 22 },
    { header: "Montant (FCFA)", key: "montant", width: 16 },
  ];
  feuille.getRow(1).font = { bold: true };

  for (const depense of depenses) {
    feuille.addRow({
      date: depense.date.toLocaleDateString("fr-SN"),
      code: depense.category.codeSyscohada ?? "",
      categorie: depense.category.name,
      fournisseur: depense.supplier ?? "",
      description: depense.description ?? "",
      moyen: MOYENS_PAIEMENT[depense.paymentMethod].libelle,
      auteur: noms.get(depense.createdById) ?? "—",
      montant: depense.amount,
    });
  }

  const colonneMontant = feuille.getColumn("montant");
  colonneMontant.numFmt = "#,##0";

  const total = depenses.reduce((somme, d) => somme + d.amount, 0);
  const ligneTotal = feuille.addRow({ description: "Total", montant: total });
  ligneTotal.font = { bold: true };

  const tampon = await classeur.xlsx.writeBuffer();

  return new Response(new Uint8Array(tampon), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="journal-depenses-${periode.param}.xlsx"`,
    },
  });
}
