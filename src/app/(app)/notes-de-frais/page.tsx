import Link from "next/link";
import { clerkClient } from "@clerk/nextjs/server";
import { Plus } from "lucide-react";
import { FormulaireNote } from "@/components/formulaire-note";
import { formatDate, formatFCFA } from "@/lib/format";
import { COULEUR_STATUT_NOTE, LIBELLE_STATUT_NOTE } from "@/lib/notes";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export default async function NotesDeFraisPage() {
  const session = await requireSession();

  // Gérant et comptable suivent les notes de toute l'entreprise (ils ont au
  // moins une action à y jouer) ; un employé ne voit que les siennes.
  const vueGestion =
    can(session.role, "reports:approve") || can(session.role, "reports:reimburse");

  const notes = await prisma.expenseReport.findMany({
    where: {
      organizationId: session.organizationId,
      ...(vueGestion ? {} : { employeeId: session.userId }),
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { expenses: true } } },
  });

  let noms = new Map<string, string>();
  if (vueGestion && notes.length > 0) {
    const client = await clerkClient();
    const { data: utilisateurs } = await client.users.getUserList({
      userId: [...new Set(notes.map((n) => n.employeeId))],
      limit: 100,
    });
    noms = new Map(
      utilisateurs.map((u) => [
        u.id,
        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
          u.username ||
          "Employé",
      ]),
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titre text-2xl md:text-3xl">Notes de frais</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {vueGestion
              ? "Toutes les notes de l'entreprise"
              : "Vos notes de frais"}
          </p>
        </div>
      </header>

      {notes.length > 0 && (
        <ul className="mt-8 divide-y divide-reglure border border-reglure bg-card">
          {notes.map((note) => (
            <li key={note.id}>
              <Link
                href={`/notes-de-frais/${note.id}`}
                className="flex items-center gap-3 px-4 py-4 hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{note.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {vueGestion && `${noms.get(note.employeeId) ?? "Employé"} · `}
                    {note._count.expenses} dépense
                    {note._count.expenses > 1 ? "s" : ""} ·{" "}
                    {formatDate(note.updatedAt)}
                  </p>
                </div>
                <span className="chiffre shrink-0 text-sm font-medium">
                  {formatFCFA(note.totalAmount)}
                </span>
                <span
                  className={`shrink-0 text-xs font-medium ${COULEUR_STATUT_NOTE[note.status]}`}
                >
                  {LIBELLE_STATUT_NOTE[note.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {notes.length === 0 && (
        <div className="mt-8 border border-dashed border-reglure bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Aucune note de frais. Regroupez vos dépenses avec justificatifs
            dans une note, elle sera validée puis remboursée.
          </p>
        </div>
      )}

      <h2 className="titre mt-10 flex items-center gap-2 text-xl">
        <Plus className="size-4" aria-hidden />
        Nouvelle note
      </h2>
      <FormulaireNote />
    </div>
  );
}
