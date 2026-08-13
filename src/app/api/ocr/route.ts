import type { NextRequest } from "next/server";
import { extraireDonneesRecu } from "@/lib/ocr";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { TAILLE_MAX_JUSTIFICATIF, TYPES_JUSTIFICATIF } from "@/lib/storage";

/**
 * OCR d'un reçu — PROJET.md §9.
 *
 * Reçoit le fichier du formulaire AVANT l'enregistrement de la dépense :
 * l'extraction sert à pré-remplir, l'humain valide, et c'est l'action
 * serveur qui archivera le résultat dans Receipt au moment de la création.
 */
export async function POST(request: NextRequest) {
  const session = await requireSession();
  if (!can(session.role, "expenses:write")) {
    return Response.json({ erreur: "Accès refusé" }, { status: 403 });
  }

  const donnees = await request.formData();
  const brut = donnees.get("fichier");
  const fichier = brut instanceof File && brut.size > 0 ? brut : null;

  if (!fichier) {
    return Response.json({ erreur: "Aucun fichier reçu" }, { status: 400 });
  }
  if (!TYPES_JUSTIFICATIF[fichier.type]) {
    return Response.json(
      { erreur: "Formats acceptés : JPG, PNG, WebP ou PDF" },
      { status: 400 },
    );
  }
  if (fichier.size > TAILLE_MAX_JUSTIFICATIF) {
    return Response.json({ erreur: "Fichier trop lourd (10 Mo max)" }, {
      status: 400,
    });
  }

  // Les noms de catégories guident la suggestion : Claude choisit dans la
  // liste de CETTE entreprise, pas dans un référentiel imaginaire.
  const categories = await prisma.category.findMany({
    where: { organizationId: session.organizationId },
    select: { name: true },
  });

  try {
    const extraction = await extraireDonneesRecu({
      fichier,
      nomsCategories: categories.map((c) => c.name),
    });
    return Response.json(extraction);
  } catch {
    // Panne ou clé absente : le formulaire reste utilisable à la main,
    // l'OCR est un confort, jamais un point de blocage.
    return Response.json(
      { erreur: "Analyse impossible pour le moment. Saisissez manuellement." },
      { status: 502 },
    );
  }
}
