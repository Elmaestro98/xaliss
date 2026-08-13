"use server";

import { revalidatePath } from "next/cache";
import * as z from "zod";
import { seuilsDepuisAlerte } from "@/lib/parametres";
import { assertCan } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export type EtatFormulaire = {
  erreurs?: Record<string, string[]>;
  message?: string;
  succes?: boolean;
};

/**
 * Une catégorie = une ligne du plan de comptes de l'entreprise. Le code
 * SYSCOHADA (601, 6053, 64…) est un vrai numéro de compte : facultatif, mais
 * s'il est saisi, c'est un nombre de 2 à 4 chiffres. La couleur vient d'un
 * <input type="color"> (toujours au format #rrggbb).
 */
const SchemaCategorie = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Donnez un nom à la catégorie.")
    .max(60, "60 caractères au maximum."),
  codeSyscohada: z
    .string()
    .trim()
    .regex(
      /^\d{2,4}$/,
      "Le code SYSCOHADA est un numéro de 2 à 4 chiffres (ex. 601, 6053).",
    )
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Choisissez une couleur valide."),
});

function lire(donnees: FormData) {
  const code = (donnees.get("codeSyscohada") ?? "").toString().trim();
  return SchemaCategorie.safeParse({
    name: donnees.get("name"),
    // Un code vide devient « absent » : le champ est facultatif.
    codeSyscohada: code === "" ? undefined : code,
    color: donnees.get("color"),
  });
}

/**
 * Un même code SYSCOHADA sur deux catégories brouillerait le journal et les
 * exports : une catégorie, un compte. On refuse le doublon (en excluant la
 * catégorie elle-même lors d'une modification).
 */
async function codeDejaPris(
  organizationId: string,
  code: string,
  sauf?: string,
): Promise<boolean> {
  const doublon = await prisma.category.findFirst({
    where: {
      organizationId,
      codeSyscohada: code,
      ...(sauf ? { id: { not: sauf } } : {}),
    },
    select: { id: true },
  });
  return doublon !== null;
}

export async function creerCategorie(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const session = await requireSession();
  assertCan(session.role, "categories:manage");

  const resultat = lire(donnees);
  if (!resultat.success) {
    return {
      erreurs: z.flattenError(resultat.error).fieldErrors,
      message: "Vérifiez les champs signalés.",
    };
  }
  const { name, codeSyscohada, color } = resultat.data;

  if (codeSyscohada && (await codeDejaPris(session.organizationId, codeSyscohada))) {
    return {
      erreurs: {
        codeSyscohada: ["Ce code est déjà utilisé par une autre catégorie."],
      },
    };
  }

  const categorie = await prisma.category.create({
    data: {
      organizationId: session.organizationId,
      name,
      codeSyscohada: codeSyscohada ?? null,
      color,
      isDefault: false,
    },
    select: { id: true },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: session.organizationId,
      actorId: session.userId,
      entity: "Category",
      entityId: categorie.id,
      action: "CREATION",
      metadata: { name, codeSyscohada: codeSyscohada ?? null },
    },
  });

  // La catégorie apparaît dans les sélecteurs de dépense et de budget.
  revalidatePath("/parametres");
  revalidatePath("/depenses");
  revalidatePath("/budgets");
  return {};
}

export async function modifierCategorie(
  id: string,
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const session = await requireSession();
  assertCan(session.role, "categories:manage");

  const resultat = lire(donnees);
  if (!resultat.success) {
    return { erreurs: z.flattenError(resultat.error).fieldErrors };
  }
  const { name, codeSyscohada, color } = resultat.data;

  // Bornée au tenant : un identifiant étranger ne modifie rien.
  const existante = await prisma.category.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true },
  });
  if (!existante) {
    return { message: "Cette catégorie n'existe plus." };
  }

  if (
    codeSyscohada &&
    (await codeDejaPris(session.organizationId, codeSyscohada, id))
  ) {
    return {
      erreurs: {
        codeSyscohada: ["Ce code est déjà utilisé par une autre catégorie."],
      },
    };
  }

  await prisma.category.update({
    where: { id },
    data: { name, codeSyscohada: codeSyscohada ?? null, color },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: session.organizationId,
      actorId: session.userId,
      entity: "Category",
      entityId: id,
      action: "MODIFICATION",
      metadata: { name, codeSyscohada: codeSyscohada ?? null },
    },
  });

  revalidatePath("/parametres");
  revalidatePath("/depenses");
  revalidatePath("/budgets");
  return {};
}

export async function supprimerCategorie(id: string): Promise<void> {
  const session = await requireSession();
  assertCan(session.role, "categories:manage");

  // Garde-fou : une catégorie rattachée à une dépense ou un budget ne peut
  // pas partir (la clé étrangère l'interdit, et l'historique comptable doit
  // rester lisible). L'interface désactive déjà le bouton dans ce cas.
  const [nbDepenses, nbBudgets] = await Promise.all([
    prisma.expense.count({
      where: { organizationId: session.organizationId, categoryId: id },
    }),
    prisma.budget.count({
      where: { organizationId: session.organizationId, categoryId: id },
    }),
  ]);
  if (nbDepenses > 0 || nbBudgets > 0) return;

  const resultat = await prisma.category.deleteMany({
    where: { id, organizationId: session.organizationId },
  });

  if (resultat.count > 0) {
    await prisma.auditLog.create({
      data: {
        organizationId: session.organizationId,
        actorId: session.userId,
        entity: "Category",
        entityId: id,
        action: "SUPPRESSION",
        metadata: {},
      },
    });
  }

  revalidatePath("/parametres");
}

const SchemaSeuil = z.object({
  seuilAlerte: z.coerce
    .number({ error: "Indiquez un pourcentage." })
    .int("Un pourcentage entier, sans virgule.")
    .min(1, "Le seuil doit être supérieur à zéro.")
    .max(99, "Le seuil doit rester sous 100 % — 100 % est déjà le dépassement."),
});

/**
 * Enregistre le seuil d'alerte de l'entreprise (PROJET.md §4.5). C'est un
 * réglage global : on l'écrit dans Organization.settings ET on aligne tous les
 * budgets existants dessus (V1 n'expose pas de seuil par budget). Les seuils
 * posés sur chaque Budget restent la source lue par lib/alertes-budget.ts.
 */
export async function enregistrerSeuilAlerte(
  _etat: EtatFormulaire,
  donnees: FormData,
): Promise<EtatFormulaire> {
  const session = await requireSession();
  assertCan(session.role, "budgets:manage");

  const resultat = SchemaSeuil.safeParse({
    seuilAlerte: donnees.get("seuilAlerte"),
  });
  if (!resultat.success) {
    return { erreurs: z.flattenError(resultat.error).fieldErrors };
  }

  const seuils = seuilsDepuisAlerte(resultat.data.seuilAlerte);

  // Atomique : le défaut de l'entreprise et les budgets existants ne doivent
  // jamais diverger. settings ne porte que ce réglage pour l'instant.
  await prisma.$transaction([
    prisma.organization.update({
      where: { id: session.organizationId },
      data: { settings: { alertThresholds: seuils } },
    }),
    prisma.budget.updateMany({
      where: { organizationId: session.organizationId },
      data: { alertThresholds: seuils },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      organizationId: session.organizationId,
      actorId: session.userId,
      entity: "Organization",
      entityId: session.organizationId,
      action: "MODIFICATION",
      metadata: { alertThresholds: seuils },
    },
  });

  revalidatePath("/parametres");
  revalidatePath("/budgets");
  return { succes: true };
}
