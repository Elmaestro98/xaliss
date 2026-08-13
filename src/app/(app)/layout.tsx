import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { type LienNav, NavLaterale, NavMobile } from "@/components/navigation";
import { ROLES } from "@/lib/paiement";
import { can } from "@/lib/permissions";
import { requireSession } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireSession() est mémoïsée : chaque page la rappelle pour sa propre
  // vérification, sans requête supplémentaire.
  const { role } = await requireSession();

  // La navigation dérive de la matrice de permissions (PROJET.md §5) :
  // un employé ne voit pas les entrées qu'il ne peut pas utiliser.
  const liens: LienNav[] = [
    { href: "/dashboard", libelle: "Tableau de bord", icone: "dashboard" },
    { href: "/depenses", libelle: "Dépenses", icone: "depenses" },
    { href: "/notes-de-frais", libelle: "Notes de frais", icone: "notes" },
    ...(can(role, "budgets:manage")
      ? [{ href: "/budgets", libelle: "Budgets", icone: "budgets" as const }]
      : []),
    ...(can(role, "exports:generate")
      ? [{ href: "/rapports", libelle: "Rapports", icone: "rapports" as const }]
      : []),
    ...(can(role, "members:manage")
      ? [{ href: "/equipe", libelle: "Équipe", icone: "equipe" as const }]
      : []),
    ...(can(role, "members:manage")
      ? [
          {
            href: "/parametres",
            libelle: "Paramètres",
            icone: "parametres" as const,
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-full flex-1">
      {/* Écrans larges : la couverture sombre du cahier */}
      <aside className="hidden w-60 shrink-0 flex-col gap-6 bg-sidebar py-5 md:flex">
        <div className="flex flex-col items-start gap-3 px-5">
          <span className="titre text-xl text-white">Xaalis</span>
          {/*
            Styles en ligne plutôt que classes : la barre est sombre et les
            styles internes de Clerk (texte foncé) l'emportent sur une classe
            utilitaire. Le menu déroulant, lui, s'ouvre sur fond clair et garde
            ses couleurs par défaut.
          */}
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/dashboard"
            appearance={{
              elements: {
                organizationSwitcherTrigger: {
                  color: "#c3cbdd",
                  paddingInline: 0,
                  gap: "0.375rem",
                },
                organizationPreviewMainIdentifier: { color: "#c3cbdd" },
              },
            }}
          />
        </div>

        <NavLaterale liens={liens} />

        <div className="mt-auto flex items-center gap-3 border-t border-sidebar-border px-5 pt-4">
          <UserButton />
          <p className="truncate text-xs text-sidebar-foreground">
            {ROLES[role]}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile : l'entreprise en haut, la navigation sous le pouce */}
        <header className="flex items-center justify-between border-b border-reglure bg-card px-4 py-3 md:hidden">
          <span className="titre text-lg">Xaalis</span>
          <div className="flex items-center gap-2">
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/dashboard"
            />
            <UserButton />
          </div>
        </header>

        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <NavMobile liens={liens.slice(0, 5)} />
      </div>

      <Toaster position="top-center" />
    </div>
  );
}
