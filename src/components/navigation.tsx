"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumnIncreasing,
  CreditCard,
  Gauge,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONES = {
  dashboard: LayoutDashboard,
  depenses: Receipt,
  budgets: Gauge,
  notes: Wallet,
  rapports: ChartColumnIncreasing,
  equipe: Users,
  parametres: Settings,
  abonnement: CreditCard,
} as const;

export type LienNav = {
  href: string;
  libelle: string;
  icone: keyof typeof ICONES;
};

function estActif(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Barre latérale — écrans larges. La couverture sombre du cahier.
 *
 * Les libellés restent écrits, contre l'usage des tableaux de bord qui
 * réduisent leur barre à une colonne d'icônes. Xaalis n'est pas un outil
 * qu'on ouvre huit heures par jour : un chauffeur y passe deux minutes par
 * semaine pour une note de frais, et n'aura jamais appris qu'un portefeuille
 * veut dire « notes de frais ». Une icône seule est un raccourci pour les
 * habitués, payé par les autres.
 */
export function NavLaterale({ liens }: { liens: LienNav[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {liens.map((lien) => {
        const Icone = ICONES[lien.icone];
        const actif = estActif(pathname, lien.href);
        return (
          <Link
            key={lien.href}
            href={lien.href}
            aria-current={actif ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-lg py-2 pl-4 pr-3 text-sm transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-ring",
              actif
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            {/* La marge du cahier : la page ouverte porte son repère à gauche,
                à l'intérieur de l'arrondi plutôt qu'en travers de lui. */}
            {actif && (
              <span
                aria-hidden
                className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-sidebar-primary"
              />
            )}
            <Icone className="size-4 shrink-0" aria-hidden />
            {lien.libelle}
          </Link>
        );
      })}
    </nav>
  );
}

/** Barre du bas — mobile. À portée du pouce, comme une application native. */
export function NavMobile({ liens }: { liens: LienNav[] }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-reglure bg-card/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Navigation principale"
    >
      <ul className="flex">
        {liens.map((lien) => {
          const Icone = ICONES[lien.icone];
          const actif = estActif(pathname, lien.href);
          return (
            <li key={lien.href} className="flex-1">
              <Link
                href={lien.href}
                aria-current={actif ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] transition-colors",
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  actif ? "text-indigo" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    actif && "bg-indigo/15",
                  )}
                >
                  <Icone className="size-5" aria-hidden />
                </span>
                <span className="max-w-full truncate px-1">{lien.libelle}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
