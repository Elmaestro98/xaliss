import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FormulaireDepense } from "@/components/formulaire-depense";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export default async function NouvelleDepensePage() {
  const session = await requireSession();

  // L'employé passe par une note de frais : la page elle-même refuse, pas
  // seulement le bouton qui y mène.
  if (!can(session.role, "expenses:write")) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 md:px-8">
        <h1 className="titre text-2xl">Passez par une note de frais</h1>
        <p className="mt-3 text-muted-foreground">
          Votre rôle ne permet pas de saisir une dépense directement dans le
          journal de l&apos;entreprise. Regroupez vos dépenses dans une note de
          frais : elle sera validée puis remboursée.
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

  const categories = await prisma.category.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { codeSyscohada: "asc" },
    select: { id: true, name: true, codeSyscohada: true, color: true },
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-10">
      <Link
        href="/depenses"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Dépenses
      </Link>
      <h1 className="titre mt-3 text-2xl md:text-3xl">Nouvelle dépense</h1>
      <FormulaireDepense categories={categories} />
    </div>
  );
}
