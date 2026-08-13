"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { verifierAlertesBudget } from "@/lib/alertes-budget";
import { SchemaExtractionRecu } from "@/lib/ocr";
import { assertCan } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { SchemaDepense } from "@/lib/schema-depense";
import { requireSession } from "@/lib/session";
import {
  supprimerJustificatif,
  TAILLE_MAX_JUSTIFICATIF,
  televerserJustificatif,
  TYPES_JUSTIFICATIF,
} from "@/lib/storage";

export type EtatFormulaire = {
  erreurs?: Record<string, string[]>;
  message?: string;
};

export async function creerDepense(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const session = await requireSession();
  // Un employé passe par une note de frais, jamais par une dépense directe.
  assertCan(session.role, "expenses:write");

  const resultat = SchemaDepense.safeParse({
    amount: donnees.get("amount"),
    date: donnees.get("date"),
    categoryId: donnees.get("categoryId"),
    paymentMethod: donnees.get("paymentMethod"),
    supplier: donnees.get("supplier") || undefined,
    description: donnees.get("description") || undefined,
  });

  if (!resultat.success) {
    return {
      erreurs: z.flattenError(resultat.error).fieldErrors,
      message: "Vérifiez les champs signalés.",
    };
  }

  // La catégorie doit appartenir à l'entreprise : sans ce contrôle, un
  // identifiant forgé rattacherait la dépense à une autre entreprise.
  const categorie = await prisma.category.findFirst({
    where: {
      id: resultat.data.categoryId,
      organizationId: session.organizationId,
    },
    select: { id: true },
  });
  if (!categorie) {
    return { erreurs: { categoryId: ["Cette catégorie n'existe pas."] } };
  }

  // Un input file soumis vide arrive comme File de taille 0 : même absence.
  const brut = donnees.get("justificatif");
  const justificatif = brut instanceof File && brut.size > 0 ? brut : null;

  if (justificatif) {
    if (!TYPES_JUSTIFICATIF[justificatif.type]) {
      return {
        erreurs: {
          justificatif: ["Formats acceptés : photo (JPG, PNG, WebP) ou PDF."],
        },
      };
    }
    if (justificatif.size > TAILLE_MAX_JUSTIFICATIF) {
      return {
        erreurs: { justificatif: ["Le fichier dépasse 10 Mo."] },
      };
    }
  }

  // Le fichier part dans le bucket avant l'écriture en base : si la base
  // échoue ensuite, le catch efface le fichier. L'ordre inverse serait pire —
  // une dépense qui référence un justificatif jamais téléversé.
  let cheminJustificatif: string | null = null;
  if (justificatif) {
    try {
      cheminJustificatif = await televerserJustificatif({
        organizationId: session.organizationId,
        fichier: justificatif,
      });
    } catch {
      return {
        erreurs: {
          justificatif: ["Téléversement impossible. Réessayez dans un instant."],
        },
      };
    }
  }

  try {
    // Tout ou rien : une dépense sans sa ligne d'audit, ou un justificatif
    // sans sa dépense, seraient des états incohérents.
    await prisma.$transaction(async (tx) => {
      const depense = await tx.expense.create({
        data: {
          ...resultat.data,
          organizationId: session.organizationId,
          createdById: session.userId,
        },
        select: { id: true },
      });

      if (cheminJustificatif) {
        // Le résultat OCR arrive du navigateur (champ caché) : revalidé au
        // schéma avant archivage — c'est de l'audit, pas une donnée de
        // confiance, un contenu forgé est simplement ignoré.
        const ocrBrut = donnees.get("ocrData");
        const ocr =
          typeof ocrBrut === "string" && ocrBrut.length < 10_000
            ? SchemaExtractionRecu.safeParse(
                (() => {
                  try {
                    return JSON.parse(ocrBrut);
                  } catch {
                    return null;
                  }
                })(),
              )
            : null;

        // fileUrl stocke le chemin dans le bucket, pas une URL : l'URL
        // signée se fabrique à chaque consultation (lib/storage.ts).
        await tx.receipt.create({
          data: {
            expenseId: depense.id,
            fileUrl: cheminJustificatif,
            ...(ocr?.success
              ? {
                  ocrData: ocr.data,
                  confidence: ocr.data.confidence,
                  ocrStatus: "SUCCESS" as const,
                }
              : {}),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: session.organizationId,
          actorId: session.userId,
          entity: "Expense",
          entityId: depense.id,
          action: "CREATION",
          metadata: { amount: resultat.data.amount },
        },
      });
    });
  } catch (erreur) {
    if (cheminJustificatif) {
      await supprimerJustificatif(cheminJustificatif);
    }
    throw erreur;
  }

  // Après la transaction, jamais dedans : un email raté ne doit pas
  // annuler une écriture comptable. La fonction avale ses propres erreurs.
  await verifierAlertesBudget({
    organizationId: session.organizationId,
    categoryId: resultat.data.categoryId,
    montant: resultat.data.amount,
    dateDepense: resultat.data.date,
  });

  revalidatePath("/depenses");
  revalidatePath("/dashboard");
  redirect("/depenses");
}
