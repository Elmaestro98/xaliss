import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { Role, SubscriptionStatus } from "@/generated/prisma/enums";
import { marquerImpaye, suspendre } from "@/lib/abonnement";
import { envoyerEmail } from "@/lib/email";
import { formatDate } from "@/lib/format";
import { JOURS_DE_GRACE, PLANS } from "@/lib/plans";
import { prisma, prismaHorsPortee } from "@/lib/prisma";

/**
 * Échéances des abonnements — PROJET.md §9.
 *
 * Deux bascules, dans cet ordre : la période payée s'achève sans
 * renouvellement → PAST_DUE et le délai de grâce démarre ; le délai s'écoule
 * → SUSPENDED, lecture seule.
 *
 * Rien n'est jamais supprimé ici. Un impayé ferme la saisie, pas le registre :
 * une PME doit pouvoir consulter et exporter sa comptabilité même après avoir
 * cessé de payer. C'est la même règle que la suppression d'entreprise
 * (PROJET.md §6) — les données du client lui appartiennent.
 */

type Bascule = { organisation: string; plan: string };

export async function traiterEcheances(maintenant = new Date()): Promise<{
  impayes: Bascule[];
  suspendus: Bascule[];
}> {
  const impayes: Bascule[] = [];
  const suspendus: Bascule[] = [];

  // 1. Échéance atteinte, rien n'a été payé : le délai de grâce démarre.
  // Hors portée : un cron d'échéance passe en revue TOUTES les entreprises —
  // c'est sa raison d'être. Le restreindre à une seule le rendrait inutile.
  const echus = await prismaHorsPortee.subscription.findMany({
    where: {
      status: {
        in: [SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE],
      },
      currentPeriodEnd: { lt: maintenant },
      // Inutile de relancer une entreprise déjà supprimée.
      organization: { deletedAt: null },
    },
    include: { organization: { select: { id: true, name: true } } },
  });

  for (const abonnement of echus) {
    const aJour = await marquerImpaye(abonnement.id, maintenant);
    impayes.push({
      organisation: abonnement.organization.name,
      plan: abonnement.plan,
    });

    await prevenirGerants({
      organizationId: abonnement.organization.id,
      sujet: "Votre abonnement Xaalis arrive à échéance",
      titre: "Paiement requis",
      corps: `Votre plan ${PLANS[abonnement.plan].nom} est arrivé à échéance.
        Vous conservez un accès complet pendant ${JOURS_DE_GRACE} jours, jusqu'au
        ${formatDate(aJour.graceEndsAt ?? maintenant)}. Passé cette date, Xaalis
        passe en lecture seule : vos données restent consultables et
        exportables, mais la saisie est bloquée.`,
      couleur: "#b45309",
    });
  }

  // 2. Délai de grâce écoulé : passage en lecture seule.
  // Hors portée, pour la même raison qu'au point 1.
  const aSuspendre = await prismaHorsPortee.subscription.findMany({
    where: {
      status: SubscriptionStatus.PAST_DUE,
      graceEndsAt: { not: null, lt: maintenant },
      organization: { deletedAt: null },
    },
    include: { organization: { select: { id: true, name: true } } },
  });

  for (const abonnement of aSuspendre) {
    await suspendre(abonnement.id);
    suspendus.push({
      organisation: abonnement.organization.name,
      plan: abonnement.plan,
    });

    await prevenirGerants({
      organizationId: abonnement.organization.id,
      sujet: "Xaalis est passé en lecture seule",
      titre: "Abonnement suspendu",
      corps: `Faute de renouvellement, votre abonnement est suspendu. Vos
        données sont intactes : vous pouvez toujours les consulter et les
        exporter. Choisissez un plan depuis Xaalis → Abonnement pour rouvrir la
        saisie.`,
      couleur: "#b91c1c",
    });
  }

  return { impayes, suspendus };
}

/**
 * Les questions d'argent vont au gérant seul (PROJET.md §9) : le comptable est
 * prévenu des budgets, pas de la facturation.
 */
async function prevenirGerants(params: {
  organizationId: string;
  sujet: string;
  titre: string;
  corps: string;
  couleur: string;
}): Promise<void> {
  const adhesions = await prisma.membership.findMany({
    where: { organizationId: params.organizationId, role: Role.ADMIN },
    select: { userId: true },
  });
  if (adhesions.length === 0) return;

  const client = await clerkClient();
  const { data: utilisateurs } = await client.users.getUserList({
    userId: adhesions.map((a) => a.userId),
    limit: 100,
  });
  const destinataires = utilisateurs
    .map((u) => u.primaryEmailAddress?.emailAddress)
    .filter((email): email is string => Boolean(email));

  await envoyerEmail({
    destinataires,
    sujet: params.sujet,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 520px;">
        <h2 style="margin: 0 0 12px; color: ${params.couleur};">${params.titre}</h2>
        <p style="margin: 0 0 20px; color: #334155; line-height: 1.6;">${params.corps}</p>
        <p style="margin: 0; color: #64748b; font-size: 14px;">
          Xaalis → Abonnement
        </p>
      </div>
    `,
  });
}
