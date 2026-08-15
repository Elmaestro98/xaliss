"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import * as z from "zod";
import { Role } from "@/generated/prisma/enums";
import {
  AbonnementError,
  assertFonctionnalite,
  assertPeutEcrire,
  etatCourant,
} from "@/lib/abonnement";
import { verifierAlertesBudget } from "@/lib/alertes-budget";
import { envoyerEmail } from "@/lib/email";
import { formatFCFA } from "@/lib/format";
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

/**
 * Notes de frais — PROJET.md §4.3 et §8.
 *
 * Workflow : BROUILLON → SOUMISE → APPROUVEE | REJETEE → REMBOURSEE, avec
 * REJETEE → BROUILLON (correction). Chaque transition pose une ligne
 * Approval (l'historique métier) et une ligne AuditLog (la trace technique).
 *
 * Les dépenses rattachées (Expense.reportId) n'intègrent le journal de
 * l'entreprise qu'au remboursement — voir lib/journal.ts. C'est pourquoi les
 * alertes budget ne sont vérifiées qu'à ce moment-là, jamais à l'ajout.
 */

export type EtatFormulaire = {
  erreurs?: Record<string, string[]>;
  message?: string;
};

export type EtatAjoutDepense = EtatFormulaire & { succes?: boolean };

async function emailUtilisateur(userId: string): Promise<string | null> {
  const client = await clerkClient();
  const utilisateur = await client.users.getUser(userId);
  return utilisateur.primaryEmailAddress?.emailAddress ?? null;
}

function nomUtilisateur(utilisateur: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}): string {
  return (
    [utilisateur.firstName, utilisateur.lastName].filter(Boolean).join(" ") ||
    utilisateur.username ||
    "Un employé"
  );
}

/** Gérant(s) de l'entreprise — seul destinataire d'une soumission (PROJET.md §9). */
async function emailsGerants(organizationId: string): Promise<string[]> {
  const adhesions = await prisma.membership.findMany({
    where: { organizationId, role: Role.ADMIN },
    select: { userId: true },
  });
  if (adhesions.length === 0) return [];

  const client = await clerkClient();
  const { data: utilisateurs } = await client.users.getUserList({
    userId: adhesions.map((a) => a.userId),
    limit: 100,
  });
  return utilisateurs
    .map((u) => u.primaryEmailAddress?.emailAddress)
    .filter((email): email is string => Boolean(email));
}

const SchemaNote = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Donnez un titre à cette note.")
    .max(120, "Titre trop long."),
});

export async function creerNote(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const session = await requireSession();
  assertCan(session.role, "reports:submit");

  // Les notes de frais sont incluses à partir du plan Pro (PROJET.md §11).
  // Le contrôle est posé à la création : une note déjà ouverte doit pouvoir
  // suivre son cours jusqu'au remboursement, même après un changement de plan
  // — un employé ne doit pas rester avec une avance non remboursée.
  const etat = await etatCourant(session.organizationId);
  try {
    assertPeutEcrire(etat);
    assertFonctionnalite(etat.plan, "notes-de-frais");
  } catch (erreur) {
    if (erreur instanceof AbonnementError) return { message: erreur.message };
    throw erreur;
  }

  const resultat = SchemaNote.safeParse({ title: donnees.get("title") });
  if (!resultat.success) {
    return { erreurs: z.flattenError(resultat.error).fieldErrors };
  }

  const note = await prisma.$transaction(async (tx) => {
    const note = await tx.expenseReport.create({
      data: {
        organizationId: session.organizationId,
        employeeId: session.userId,
        title: resultat.data.title,
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorId: session.userId,
        entity: "ExpenseReport",
        entityId: note.id,
        action: "CREATION",
      },
    });
    return note;
  });

  revalidatePath("/notes-de-frais");
  redirect(`/notes-de-frais/${note.id}`);
}

/**
 * Ajoute une dépense à une note en BROUILLON — c'est la seule porte par
 * laquelle un employé sans `expenses:write` fait exister une dépense
 * (PROJET.md §5 : « Créer une dépense — Via note de frais »).
 */
export async function ajouterDepenseNote(
  reportId: string,
  _etat: EtatAjoutDepense,
  donnees: FormData,
): Promise<EtatAjoutDepense> {
  const session = await requireSession();
  assertCan(session.role, "reports:submit");

  // Seule l'auteure de la note peut la remplir, et seulement tant qu'elle
  // n'a pas quitté le brouillon — sans quoi un ajout tardif contournerait
  // la validation déjà donnée par le gérant.
  const note = await prisma.expenseReport.findFirst({
    where: {
      id: reportId,
      organizationId: session.organizationId,
      employeeId: session.userId,
      status: "BROUILLON",
    },
    select: { id: true },
  });
  if (!note) {
    return { message: "Cette note n'est plus modifiable." };
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
      return { erreurs: { justificatif: ["Le fichier dépasse 10 Mo."] } };
    }
  }

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
    await prisma.$transaction(async (tx) => {
      const depense = await tx.expense.create({
        data: {
          ...resultat.data,
          organizationId: session.organizationId,
          createdById: session.userId,
          reportId: note.id,
        },
        select: { id: true },
      });

      if (cheminJustificatif) {
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

      await tx.expenseReport.update({
        where: { id: note.id },
        data: { totalAmount: { increment: resultat.data.amount } },
      });

      await tx.auditLog.create({
        data: {
          organizationId: session.organizationId,
          actorId: session.userId,
          entity: "Expense",
          entityId: depense.id,
          action: "CREATION",
          metadata: { reportId: note.id, amount: resultat.data.amount },
        },
      });
    });
  } catch (erreur) {
    if (cheminJustificatif) {
      await supprimerJustificatif(cheminJustificatif);
    }
    throw erreur;
  }

  revalidatePath(`/notes-de-frais/${note.id}`);
  return { message: "Dépense ajoutée à la note.", succes: true };
}

/** Retire une dépense d'une note encore en BROUILLON. */
export async function retirerDepenseNote(expenseId: string): Promise<void> {
  const session = await requireSession();

  const depense = await prisma.expense.findFirst({
    where: { id: expenseId, organizationId: session.organizationId },
    include: {
      report: { select: { id: true, employeeId: true, status: true } },
      receipts: { select: { fileUrl: true } },
    },
  });
  if (
    !depense?.report ||
    depense.report.employeeId !== session.userId ||
    depense.report.status !== "BROUILLON"
  ) {
    return;
  }
  const reportId = depense.report.id;

  await prisma.$transaction(async (tx) => {
    await tx.expense.delete({ where: { id: expenseId } });
    await tx.expenseReport.update({
      where: { id: reportId },
      data: { totalAmount: { decrement: depense.amount } },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorId: session.userId,
        entity: "Expense",
        entityId: expenseId,
        action: "SUPPRESSION",
        metadata: { reportId },
      },
    });
  });

  for (const recu of depense.receipts) {
    await supprimerJustificatif(recu.fileUrl);
  }

  revalidatePath(`/notes-de-frais/${reportId}`);
}

/** Soumission : BROUILLON → SOUMISE. Notifie le gérant (PROJET.md §8). */
export async function soumettreNote(reportId: string): Promise<void> {
  const session = await requireSession();
  assertCan(session.role, "reports:submit");

  const note = await prisma.expenseReport.findFirst({
    where: {
      id: reportId,
      organizationId: session.organizationId,
      employeeId: session.userId,
      status: "BROUILLON",
    },
    include: { _count: { select: { expenses: true } } },
  });
  // Une note vide n'a rien à faire valider — l'interface masque déjà le
  // bouton dans ce cas, ce contrôle n'est qu'un filet.
  if (!note || note._count.expenses === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.expenseReport.update({
      where: { id: reportId },
      data: { status: "SOUMISE", submittedAt: new Date() },
    });
    await tx.approval.create({
      data: { reportId, actorId: session.userId, action: "SOUMISSION" },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorId: session.userId,
        entity: "ExpenseReport",
        entityId: reportId,
        action: "SOUMISSION",
      },
    });
  });

  const destinataires = await emailsGerants(session.organizationId);
  if (destinataires.length > 0) {
    const client = await clerkClient();
    const auteur = await client.users.getUser(session.userId);
    await envoyerEmail({
      destinataires,
      sujet: `🧾 Note de frais à valider — ${note.title}`,
      html: `
        <div style="font-family: system-ui, sans-serif; max-width: 520px;">
          <h2 style="margin: 0 0 4px;">Nouvelle note de frais à valider</h2>
          <p style="margin: 0 0 16px; color: #64748b;">
            ${nomUtilisateur(auteur)} — ${note.title}
          </p>
          <p style="font-size: 24px; margin: 0 0 20px;">
            <strong>${formatFCFA(note.totalAmount)}</strong>
          </p>
          <p style="margin: 0; color: #64748b; font-size: 14px;">
            Consultez le détail dans Xaalis → Notes de frais.
          </p>
        </div>
      `,
    });
  }

  revalidatePath(`/notes-de-frais/${reportId}`);
  revalidatePath("/notes-de-frais");
  revalidatePath("/dashboard");
}

async function notifierEmploye(params: {
  employeeId: string;
  sujet: string;
  titre: string;
  corps: string;
}): Promise<void> {
  const destinataire = await emailUtilisateur(params.employeeId);
  if (!destinataire) return;
  await envoyerEmail({
    destinataires: [destinataire],
    sujet: params.sujet,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 520px;">
        <h2 style="margin: 0 0 4px;">${params.titre}</h2>
        <p style="margin: 0; color: #64748b; font-size: 14px;">${params.corps}</p>
      </div>
    `,
  });
}

/** Approbation : SOUMISE → APPROUVEE. ADMIN uniquement (PROJET.md §5). */
export async function approuverNote(reportId: string): Promise<void> {
  const session = await requireSession();
  assertCan(session.role, "reports:approve");

  const note = await prisma.expenseReport.findFirst({
    where: {
      id: reportId,
      organizationId: session.organizationId,
      status: "SOUMISE",
    },
  });
  if (!note) return;

  await prisma.$transaction(async (tx) => {
    await tx.expenseReport.update({
      where: { id: reportId },
      data: { status: "APPROUVEE" },
    });
    await tx.approval.create({
      data: { reportId, actorId: session.userId, action: "APPROBATION" },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorId: session.userId,
        entity: "ExpenseReport",
        entityId: reportId,
        action: "APPROBATION",
      },
    });
  });

  await notifierEmploye({
    employeeId: note.employeeId,
    sujet: `✅ Note de frais approuvée — ${note.title}`,
    titre: "Votre note de frais est approuvée",
    corps: `${note.title} (${formatFCFA(note.totalAmount)}) sera bientôt remboursée.`,
  });

  revalidatePath(`/notes-de-frais/${reportId}`);
  revalidatePath("/notes-de-frais");
}

const SchemaRejet = z.object({
  motif: z
    .string()
    .trim()
    .min(3, "Indiquez le motif du rejet.")
    .max(500, "Motif trop long."),
});

/** Rejet : SOUMISE → REJETEE. Motif obligatoire (PROJET.md §4.3). */
export async function rejeterNote(
  reportId: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const session = await requireSession();
  assertCan(session.role, "reports:approve");

  const resultat = SchemaRejet.safeParse({ motif: donnees.get("motif") });
  if (!resultat.success) {
    return { erreurs: z.flattenError(resultat.error).fieldErrors };
  }

  const note = await prisma.expenseReport.findFirst({
    where: {
      id: reportId,
      organizationId: session.organizationId,
      status: "SOUMISE",
    },
  });
  if (!note) {
    return { message: "Cette note n'est plus en attente de validation." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.expenseReport.update({
      where: { id: reportId },
      data: { status: "REJETEE", rejectionReason: resultat.data.motif },
    });
    await tx.approval.create({
      data: {
        reportId,
        actorId: session.userId,
        action: "REJET",
        comment: resultat.data.motif,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorId: session.userId,
        entity: "ExpenseReport",
        entityId: reportId,
        action: "REJET",
        metadata: { motif: resultat.data.motif },
      },
    });
  });

  await notifierEmploye({
    employeeId: note.employeeId,
    sujet: `❌ Note de frais rejetée — ${note.title}`,
    titre: "Votre note de frais a été rejetée",
    corps: `Motif : ${resultat.data.motif}. Corrigez-la puis soumettez-la à nouveau.`,
  });

  revalidatePath(`/notes-de-frais/${reportId}`);
  revalidatePath("/notes-de-frais");
  return { message: "Note rejetée." };
}

/** Correction : REJETEE → BROUILLON, pour que l'employé la modifie et la resoumette. */
export async function corrigerNote(reportId: string): Promise<void> {
  const session = await requireSession();

  const note = await prisma.expenseReport.findFirst({
    where: {
      id: reportId,
      organizationId: session.organizationId,
      employeeId: session.userId,
      status: "REJETEE",
    },
  });
  if (!note) return;

  await prisma.$transaction(async (tx) => {
    await tx.expenseReport.update({
      where: { id: reportId },
      data: { status: "BROUILLON", rejectionReason: null },
    });
    await tx.approval.create({
      data: { reportId, actorId: session.userId, action: "CORRECTION" },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorId: session.userId,
        entity: "ExpenseReport",
        entityId: reportId,
        action: "CORRECTION",
      },
    });
  });

  revalidatePath(`/notes-de-frais/${reportId}`);
  revalidatePath("/notes-de-frais");
}

/**
 * Remboursement : APPROUVEE → REMBOURSEE. C'est ici que les dépenses de la
 * note intègrent le journal de l'entreprise (PROJET.md §4.3) : leur statut
 * passe à VALIDEE et lib/journal.ts les compte désormais dans les totaux.
 * Les alertes budget ne peuvent donc se déclencher qu'à cet instant — jamais
 * plus tôt, la note n'existant pas encore pour la comptabilité.
 */
export async function rembourserNote(reportId: string): Promise<void> {
  const session = await requireSession();
  assertCan(session.role, "reports:reimburse");

  const note = await prisma.expenseReport.findFirst({
    where: {
      id: reportId,
      organizationId: session.organizationId,
      status: "APPROUVEE",
    },
    include: {
      expenses: { select: { amount: true, categoryId: true, date: true } },
    },
  });
  if (!note) return;

  await prisma.$transaction(async (tx) => {
    await tx.expense.updateMany({
      where: { reportId },
      data: { status: "VALIDEE" },
    });
    await tx.expenseReport.update({
      where: { id: reportId },
      data: { status: "REMBOURSEE" },
    });
    await tx.approval.create({
      data: { reportId, actorId: session.userId, action: "REMBOURSEMENT" },
    });
    await tx.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorId: session.userId,
        entity: "ExpenseReport",
        entityId: reportId,
        action: "REMBOURSEMENT",
      },
    });
  });

  // Hors transaction, une dépense à la fois : chaque appel réagrège le
  // journal déjà mis à jour par les précédents, même logique que la
  // génération des récurrentes (lib/recurrentes.ts).
  for (const depense of note.expenses) {
    await verifierAlertesBudget({
      organizationId: session.organizationId,
      categoryId: depense.categoryId,
      montant: depense.amount,
      dateDepense: depense.date,
    });
  }

  await notifierEmploye({
    employeeId: note.employeeId,
    sujet: `💰 Note de frais remboursée — ${note.title}`,
    titre: "Votre note de frais est remboursée",
    corps: `${formatFCFA(note.totalAmount)} pour « ${note.title} ».`,
  });

  revalidatePath(`/notes-de-frais/${reportId}`);
  revalidatePath("/notes-de-frais");
  revalidatePath("/depenses");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
}
