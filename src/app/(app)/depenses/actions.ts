"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";
import { avecSucces } from "@/lib/messages-succes";
import {
  AbonnementError,
  assertPeutEcrire,
  estEnLectureSeule,
  etatCourant,
} from "@/lib/abonnement";
import { verifierAlertesBudget } from "@/lib/alertes-budget";
import { SchemaExtractionRecu } from "@/lib/ocr";
import { assertCan } from "@/lib/permissions";
import { assertQuotaDepenses } from "@/lib/quotas";
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

/**
 * Le fichier joint, une fois vérifié — ou l'erreur à afficher.
 *
 * Partagé par la saisie et la modification : un format accepté à la création
 * et refusé à la correction serait incompréhensible.
 */
function lireJustificatif(
  donnees: FormData,
): { fichier: File | null } | { erreur: EtatFormulaire } {
  // Un input file soumis vide arrive comme File de taille 0 : même absence.
  const brut = donnees.get("justificatif");
  const fichier = brut instanceof File && brut.size > 0 ? brut : null;
  if (!fichier) return { fichier: null };

  if (!TYPES_JUSTIFICATIF[fichier.type]) {
    return {
      erreur: {
        erreurs: {
          justificatif: ["Formats acceptés : photo (JPG, PNG, WebP) ou PDF."],
        },
      },
    };
  }
  if (fichier.size > TAILLE_MAX_JUSTIFICATIF) {
    return { erreur: { erreurs: { justificatif: ["Le fichier dépasse 10 Mo."] } } };
  }
  return { fichier };
}

/**
 * Le résultat OCR arrive du navigateur (champ caché) : revalidé au schéma
 * avant archivage — c'est de l'audit, pas une donnée de confiance, un contenu
 * forgé est simplement ignoré.
 */
function lireOcr(donnees: FormData) {
  const brut = donnees.get("ocrData");
  if (typeof brut !== "string" || brut.length >= 10_000) return null;

  let objet: unknown;
  try {
    objet = JSON.parse(brut);
  } catch {
    return null;
  }

  const analyse = SchemaExtractionRecu.safeParse(objet);
  if (!analyse.success) return null;

  return {
    ocrData: analyse.data,
    confidence: analyse.data.confidence,
    ocrStatus: "SUCCESS" as const,
  };
}

export async function creerDepense(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const session = await requireSession();
  // Un employé passe par une note de frais, jamais par une dépense directe.
  assertCan(session.role, "expenses:write");

  // Le droit (rôle) et le contrat (abonnement) sont deux contrôles distincts :
  // un gérant a le droit de saisir, encore faut-il que son plan le permette
  // encore ce mois-ci. Les deux se cumulent (PROJET.md §5 et §11).
  const etat = await etatCourant(session.organizationId);
  try {
    assertPeutEcrire(etat);
    await assertQuotaDepenses(etat.plan, session.organizationId);
  } catch (erreur) {
    // Une limite d'abonnement est une information, pas une panne : elle
    // s'affiche dans le formulaire au lieu de casser la page.
    if (erreur instanceof AbonnementError) return { message: erreur.message };
    throw erreur;
  }

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

  const joint = lireJustificatif(donnees);
  if ("erreur" in joint) return joint.erreur;
  const justificatif = joint.fichier;

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
        // fileUrl stocke le chemin dans le bucket, pas une URL : l'URL
        // signée se fabrique à chaque consultation (lib/storage.ts).
        await tx.receipt.create({
          data: {
            expenseId: depense.id,
            fileUrl: cheminJustificatif,
            ...(lireOcr(donnees) ?? {}),
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
  redirect(avecSucces("/depenses", "depense-creee"));
}

/**
 * Une ligne du journal ne se corrige que si elle a été saisie directement.
 *
 * Une dépense rattachée à une note de frais est passée par le workflow
 * d'approbation (PROJET.md §8) : la retoucher depuis le journal reviendrait à
 * réécrire après coup ce qu'un gérant a approuvé. Tant que la note est en
 * BROUILLON, son auteur la corrige depuis la note elle-même ; une fois
 * remboursée, elle est figée.
 */
const MOTIF_NOTE_DE_FRAIS =
  "Cette dépense appartient à une note de frais : elle se modifie depuis la note, pas depuis le journal.";

/** La dépense corrigible, ou null : introuvable, d'une autre entreprise, ou issue d'une note. */
async function depenseCorrigible(id: string, organizationId: string) {
  const depense = await prisma.expense.findFirst({
    // Filtrer par organizationId fait partie du contrôle d'accès : une
    // dépense d'une autre entreprise doit être introuvable, pas interdite.
    where: { id, organizationId },
    select: {
      id: true,
      amount: true,
      date: true,
      categoryId: true,
      supplier: true,
      description: true,
      paymentMethod: true,
      createdById: true,
      reportId: true,
      receipts: { select: { id: true, fileUrl: true } },
    },
  });
  return depense?.reportId ? null : depense;
}

export async function modifierDepense(
  id: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const session = await requireSession();
  assertCan(session.role, "expenses:write");

  // Pas de contrôle de quota ici, contrairement à la saisie : corriger une
  // erreur ne crée pas de dépense supplémentaire. Une entreprise au plafond
  // de son plan doit pouvoir réparer une faute de frappe.
  const etatAbo = await etatCourant(session.organizationId);
  try {
    assertPeutEcrire(etatAbo);
  } catch (erreur) {
    if (erreur instanceof AbonnementError) return { message: erreur.message };
    throw erreur;
  }

  const existante = await depenseCorrigible(id, session.organizationId);
  if (!existante) {
    return { message: `Modification impossible. ${MOTIF_NOTE_DE_FRAIS}` };
  }

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

  const joint = lireJustificatif(donnees);
  if ("erreur" in joint) return joint.erreur;

  // Deux gestes distincts sur la pièce jointe : en déposer une nouvelle
  // (qui remplace l'ancienne) ou retirer celle qui est là. Déposer l'emporte :
  // qui choisit un fichier veut manifestement le garder.
  const retirer = donnees.get("retirerJustificatif") === "on";
  const remplace = Boolean(joint.fichier);
  const ancienneCloture = remplace || retirer;

  let cheminJustificatif: string | null = null;
  if (joint.fichier) {
    try {
      cheminJustificatif = await televerserJustificatif({
        organizationId: session.organizationId,
        fichier: joint.fichier,
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
    await prisma.$transaction(async (tx) => {
      await tx.expense.update({
        where: { id: existante.id },
        data: resultat.data,
      });

      if (ancienneCloture && existante.receipts.length > 0) {
        await tx.receipt.deleteMany({ where: { expenseId: existante.id } });
      }
      if (cheminJustificatif) {
        await tx.receipt.create({
          data: {
            expenseId: existante.id,
            fileUrl: cheminJustificatif,
            ...(lireOcr(donnees) ?? {}),
          },
        });
      }

      // L'avant ET l'après : sans l'état d'origine, la ligne d'audit ne dit
      // pas ce qui a changé — or c'est précisément ce qu'un contrôle cherche
      // (PROJET.md §10, journal immuable).
      await tx.auditLog.create({
        data: {
          organizationId: session.organizationId,
          actorId: session.userId,
          entity: "Expense",
          entityId: existante.id,
          action: "MODIFICATION",
          metadata: {
            avant: {
              amount: existante.amount,
              date: existante.date.toISOString(),
              categoryId: existante.categoryId,
            },
            apres: {
              amount: resultat.data.amount,
              date: resultat.data.date.toISOString(),
              categoryId: resultat.data.categoryId,
            },
            ...(ancienneCloture
              ? { justificatif: remplace ? "remplace" : "retire" }
              : {}),
          },
        },
      });
    });
  } catch (erreur) {
    // Le nouveau fichier est déjà dans le bucket mais la base n'en sait
    // rien : on l'efface, exactement comme à la création.
    if (cheminJustificatif) await supprimerJustificatif(cheminJustificatif);
    throw erreur;
  }

  // Après le commit seulement : un fichier effacé alors que la transaction
  // échoue laisserait une dépense pointant vers du vide.
  if (ancienneCloture) {
    for (const recu of existante.receipts) {
      await supprimerJustificatif(recu.fileUrl);
    }
  }

  // Le montant qui compte pour une jauge est le DELTA, pas le nouveau total :
  // passer 10 000 à 12 000 ajoute 2 000 au budget, pas 12 000. Si la
  // catégorie ou la date change, la dépense entre dans une jauge où elle
  // n'était pas comptée — elle y pèse alors son montant entier.
  const memeAssiette =
    existante.categoryId === resultat.data.categoryId &&
    existante.date.getTime() === resultat.data.date.getTime();
  await verifierAlertesBudget({
    organizationId: session.organizationId,
    categoryId: resultat.data.categoryId,
    montant: memeAssiette
      ? resultat.data.amount - existante.amount
      : resultat.data.amount,
    dateDepense: resultat.data.date,
  });

  revalidatePath("/depenses");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  redirect(avecSucces("/depenses", "depense-modifiee"));
}

/**
 * Supprime une dépense du journal, ses justificatifs avec elle.
 *
 * Ouvert au COMPTABLE autant qu'au gérant (`expenses:write`) : sans cela,
 * une saisie erronée obligerait à écrire une contre-dépense pour l'annuler —
 * un journal faussé pour cause de permission trop étroite. La ligne d'audit
 * conserve le contenu supprimé, ce que la dépense effacée ne fait plus.
 */
export async function supprimerDepense(id: string): Promise<void> {
  const session = await requireSession();
  assertCan(session.role, "expenses:write");

  // Ici pas de formulaire où afficher un message : l'abonnement suspendu
  // renvoie vers la page qui permet d'y remédier.
  const etatAbo = await etatCourant(session.organizationId);
  if (estEnLectureSeule(etatAbo)) redirect("/abonnement");

  const depense = await depenseCorrigible(id, session.organizationId);
  if (!depense) redirect("/depenses");

  await prisma.$transaction(async (tx) => {
    // Les Receipt partent en cascade (schema.prisma) ; les fichiers du
    // bucket, eux, n'ont aucune cascade — c'est la boucle ci-dessous.
    await tx.expense.delete({ where: { id: depense.id } });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorId: session.userId,
        entity: "Expense",
        entityId: depense.id,
        action: "SUPPRESSION",
        metadata: {
          amount: depense.amount,
          date: depense.date.toISOString(),
          categoryId: depense.categoryId,
          supplier: depense.supplier,
          description: depense.description,
          paymentMethod: depense.paymentMethod,
          createdById: depense.createdById,
        },
      },
    });
  });

  for (const recu of depense.receipts) {
    await supprimerJustificatif(recu.fileUrl);
  }

  revalidatePath("/depenses");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  redirect(avecSucces("/depenses", "depense-supprimee"));
}
