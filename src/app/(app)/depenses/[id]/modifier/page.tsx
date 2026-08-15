import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BoutonSupprimerDepense } from "@/components/bouton-supprimer-depense";
import { FormulaireDepense } from "@/components/formulaire-depense";
import { estEnLectureSeule, etatCourant } from "@/lib/abonnement";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export default async function ModifierDepensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  // Le même contrôle qu'à la saisie : un employé corrige ses dépenses depuis
  // sa note de frais, jamais dans le journal de l'entreprise.
  if (!can(session.role, "expenses:write")) notFound();

  const [depense, categories, etat] = await Promise.all([
    prisma.expense.findFirst({
      // organizationId dans le where : une dépense d'une autre entreprise
      // doit être introuvable, pas interdite.
      where: { id, organizationId: session.organizationId },
      select: {
        id: true,
        amount: true,
        date: true,
        categoryId: true,
        paymentMethod: true,
        supplier: true,
        description: true,
        reportId: true,
        category: { select: { name: true } },
        receipts: { select: { id: true }, take: 1 },
      },
    }),
    prisma.category.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { codeSyscohada: "asc" },
      select: { id: true, name: true, codeSyscohada: true, color: true },
    }),
    etatCourant(session.organizationId),
  ]);

  if (!depense) notFound();

  const retour = (
    <Link
      href="/depenses"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Dépenses
    </Link>
  );

  // Une dépense issue d'une note de frais est passée par l'approbation d'un
  // gérant : la retoucher ici réécrirait après coup une décision validée.
  if (depense.reportId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
        {retour}
        <h1 className="titre mt-3 text-2xl">Dépense non modifiable</h1>
        <p className="mt-3 text-muted-foreground">
          Cette dépense fait partie d&apos;une note de frais approuvée puis
          remboursée. Elle est figée : la corriger ici reviendrait à réécrire
          une décision déjà validée. Si le montant est faux, saisissez une
          dépense corrective ou contactez le gérant.
        </p>
        <Link
          href="/notes-de-frais"
          className="mt-6 inline-block text-sm text-indigo underline underline-offset-4"
        >
          Aller aux notes de frais
        </Link>
      </div>
    );
  }

  // Abonnement suspendu : le registre reste lisible, la saisie est fermée
  // (PROJET.md §7, « un impayé ferme la saisie, jamais le registre »).
  if (estEnLectureSeule(etat)) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
        {retour}
        <h1 className="titre mt-3 text-2xl">Modification suspendue</h1>
        <p className="mt-3 text-muted-foreground">
          Votre abonnement est suspendu : Xaalis reste consultable et
          exportable, mais la saisie est fermée. Régularisez le paiement pour
          reprendre les corrections.
        </p>
        <Link
          href="/abonnement"
          className="mt-6 inline-block text-sm text-indigo underline underline-offset-4"
        >
          Voir mon abonnement
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
      {retour}
      <h1 className="titre mt-3 text-2xl md:text-3xl">Modifier la dépense</h1>

      <FormulaireDepense
        categories={categories}
        depense={{
          id: depense.id,
          amount: depense.amount,
          // L'input date attend aaaa-mm-jj : formaté ici, à partir des
          // composantes locales — toISOString() décalerait d'un jour les
          // dates saisies en fin de journée.
          date: [
            depense.date.getFullYear(),
            String(depense.date.getMonth() + 1).padStart(2, "0"),
            String(depense.date.getDate()).padStart(2, "0"),
          ].join("-"),
          categoryId: depense.categoryId,
          paymentMethod: depense.paymentMethod,
          supplier: depense.supplier,
          description: depense.description,
          aUnJustificatif: depense.receipts.length > 0,
        }}
      />

      <div className="mt-10 border-t border-reglure pt-6">
        <p className="text-sm text-muted-foreground">
          Supprimer retire définitivement cette ligne du journal. L&apos;action
          reste tracée dans l&apos;historique de l&apos;entreprise.
        </p>
        <div className="mt-3">
          <BoutonSupprimerDepense
            id={depense.id}
            montant={depense.amount}
            libelle={depense.supplier ?? depense.category.name}
          />
        </div>
      </div>
    </div>
  );
}
