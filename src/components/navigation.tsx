"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumnIncreasing,
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
} as const;

export type LienNav = {
  href: string;
  libelle: string;
  icone: keyof typeof ICONES;
};

function estActif(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Barre latérale — écrans larges. La couverture sombre du cahier. */
export function NavLaterale({ liens }: { liens: LienNav[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {liens.map((lien) => {
        const Icone = ICONES[lien.icone];
        const actif = estActif(pathname, lien.href);
        return (
          <Link
            key={lien.href}
            href={lien.href}
            aria-current={actif ? "page" : undefined}
            className={cn(
              // La marge du cahier : l'élément actif porte un filet à gauche.
              "flex items-center gap-3 border-l-2 py-2 pl-3 pr-2 text-sm transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              actif
                ? "border-l-white bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "border-l-transparent text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-reglure bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
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
                  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo",
                  actif ? "text-indigo" : "text-muted-foreground",
                )}
              >
                <Icone className="size-5" aria-hidden />
                <span className="max-w-full truncate px-1">{lien.libelle}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
