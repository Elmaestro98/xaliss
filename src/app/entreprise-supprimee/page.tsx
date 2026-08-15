import { redirect } from "next/navigation";
import { OrganizationSwitcher, SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { getOrganisationSupprimee } from "@/lib/session";

/**
 * Volontairement hors du groupe (app) : son layout appelle requireSession(),
 * qui redirige ici — la page serait sa propre cible et boucleraiten boucle.
 */
export default async function EntrepriseSupprimeePage() {
  const supprimee = await getOrganisationSupprimee();
  if (!supprimee) redirect("/dashboard");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16">
      <p className="mention">
        Entreprise supprimée
      </p>
      <h1 className="titre mt-2 text-2xl">{supprimee.nom}</h1>

      <p className="mt-4 text-muted-foreground">
        Cette entreprise a été supprimée : ses dépenses, budgets et notes de
        frais ne sont plus consultables.
      </p>
      <p className="mt-3 text-muted-foreground">
        Ses données sont conservées jusqu&apos;au{" "}
        <strong className="font-medium text-foreground">
          {formatDate(supprimee.purgeLe)}
        </strong>
        , puis effacées définitivement. Pour la rétablir avant cette date,
        recréez l&apos;entreprise dans Clerk avec le même identifiant, ou
        contactez le support.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <OrganizationSwitcher
          hidePersonal
          afterSelectOrganizationUrl="/dashboard"
        />
        <SignOutButton>
          <Button variant="ghost">Se déconnecter</Button>
        </SignOutButton>
      </div>
    </div>
  );
}
