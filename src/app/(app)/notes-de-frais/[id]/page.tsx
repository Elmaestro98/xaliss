import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { ArrowLeft, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormulaireDepenseNote } from "@/components/formulaire-depense-note";
import { FormulaireRejet } from "@/components/formulaire-rejet";
import { formatDate, formatFCFA } from "@/lib/format";
import { LIBELLE_STATUT_NOTE, TON_STATUT_NOTE } from "@/lib/notes";
import { PastilleStatut } from "@/components/pastille-statut";
import { ChiffreAffichage } from "@/components/chiffre-affichage";
import { MOYENS_PAIEMENT } from "@/lib/paiement";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  approuverNote,
  corrigerNote,
  rembourserNote,
  retirerDepenseNote,
  soumettreNote,
} from "../actions";

export default async function NoteDeFraisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const note = await prisma.expenseReport.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      expenses: {
        orderBy: { date: "desc" },
        include: {
          category: { select: { name: true, codeSyscohada: true, color: true } },
          receipts: { select: { id: true }, take: 1 },
        },
      },
    },
  });

  const peutApprouver = can(session.role, "reports:approve");
  const peutRembourser = can(session.role, "reports:reimburse");
  const estAuteur = note?.employeeId === session.userId;

  // 404 plutôt que 403 : une note d'une autre entreprise, ou d'un autre
  // employé sans droit de gestion, ne doit pas révéler son existence.
  if (!note || !(estAuteur || peutApprouver || peutRembourser)) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 md:px-8">
        <h1 className="titre text-2xl">Note introuvable</h1>
        <Link
          href="/notes-de-frais"
          className="mt-6 inline-block text-sm text-indigo underline underline-offset-4"
        >
          Retour aux notes de frais
        </Link>
      </div>
    );
  }

  let auteur = "Vous";
  if (!estAuteur) {
    const client = await clerkClient();
    const utilisateur = await client.users.getUser(note.employeeId);
    auteur =
      [utilisateur.firstName, utilisateur.lastName].filter(Boolean).join(" ") ||
      utilisateur.username ||
      "Employé";
  }

  const categories = estAuteur && note.status === "BROUILLON"
    ? await prisma.category.findMany({
        where: { organizationId: session.organizationId },
        orderBy: { codeSyscohada: "asc" },
        select: { id: true, name: true, codeSyscohada: true, color: true },
      })
    : [];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <Link
        href="/notes-de-frais"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Notes de frais
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="titre text-2xl md:text-3xl">{note.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {auteur}
            {note.submittedAt && ` · soumise le ${formatDate(note.submittedAt)}`}
          </p>
        </div>
        <PastilleStatut ton={TON_STATUT_NOTE[note.status]}>
          {LIBELLE_STATUT_NOTE[note.status]}
        </PastilleStatut>
      </header>

      {/* Le total de la note est le héros de cette page : c'est la somme que
          l'employé attend, et la seule que le gérant valide. */}
      <ChiffreAffichage montant={note.totalAmount} className="mt-5" />

      {note.status === "REJETEE" && note.rejectionReason && (
        <div className="mt-4 rounded-xl border border-brique/30 bg-brique/10 px-4 py-3">
          <p className="text-sm font-medium text-brique">Motif du rejet</p>
          <p className="mt-1 text-sm text-foreground">{note.rejectionReason}</p>
        </div>
      )}

      {/* Liste des dépenses de la note */}
      {note.expenses.length > 0 && (
        <ul className="mt-6 divide-y divide-reglure overflow-hidden rounded-xl border border-reglure bg-card">
          {note.expenses.map((depense) => (
            <li key={depense.id} className="flex items-center gap-3 px-4 py-3">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: depense.category.color ?? "var(--cat-8)" }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {depense.category.name}
                  {depense.supplier && (
                    <span className="text-muted-foreground"> · {depense.supplier}</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(depense.date)} · {MOYENS_PAIEMENT[depense.paymentMethod].libelle}
                </p>
              </div>
              {depense.receipts.length > 0 && (
                <Link
                  href={`/depenses/${depense.id}/justificatif`}
                  target="_blank"
                  aria-label="Voir le justificatif"
                  className="shrink-0 text-muted-foreground hover:text-indigo"
                >
                  <Paperclip className="size-4" aria-hidden />
                </Link>
              )}
              <span className="chiffre shrink-0 text-sm font-medium">
                {formatFCFA(depense.amount)}
              </span>
              {estAuteur && note.status === "BROUILLON" && (
                <form action={retirerDepenseNote.bind(null, depense.id)}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    aria-label="Retirer cette dépense"
                    className="text-muted-foreground hover:text-brique"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {note.expenses.length === 0 && note.status === "BROUILLON" && (
        <div className="mt-6 rounded-xl border border-dashed border-reglure bg-card px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Ajoutez une première dépense ci-dessous.
          </p>
        </div>
      )}

      {/* Actions contextuelles — selon le rôle et le statut (PROJET.md §8) */}
      <div className="mt-8 space-y-6">
        {estAuteur && note.status === "BROUILLON" && (
          <form action={soumettreNote.bind(null, note.id)}>
            <Button type="submit" disabled={note.expenses.length === 0}>
              Soumettre pour validation
            </Button>
          </form>
        )}

        {estAuteur && note.status === "REJETEE" && (
          <form action={corrigerNote.bind(null, note.id)}>
            <Button type="submit">Corriger et remettre en brouillon</Button>
          </form>
        )}

        {peutApprouver && note.status === "SOUMISE" && (
          <div className="flex flex-wrap items-start gap-4">
            <form action={approuverNote.bind(null, note.id)}>
              <Button type="submit">Approuver</Button>
            </form>
            <FormulaireRejet reportId={note.id} />
          </div>
        )}

        {peutRembourser && note.status === "APPROUVEE" && (
          <form action={rembourserNote.bind(null, note.id)}>
            <Button type="submit">Marquer comme remboursée</Button>
          </form>
        )}
      </div>

      {estAuteur && note.status === "BROUILLON" && (
        <>
          <h2 className="titre mt-10 text-xl">Ajouter une dépense</h2>
          <div className="mt-6">
            <FormulaireDepenseNote reportId={note.id} categories={categories} />
          </div>
        </>
      )}
    </div>
  );
}
