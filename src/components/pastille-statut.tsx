import { cn } from "@/lib/utils";

/**
 * Les cinq tons de Xaalis. Ce ne sont pas des couleurs libres : chacun dit
 * une chose et une seule, la même partout dans l'application.
 *
 *   neutre — rien n'est encore engagé (brouillon)
 *   indigo — en cours, la balle est dans le camp de quelqu'un
 *   ocre   — accepté mais pas soldé, ou seuil d'alerte atteint
 *   vert   — soldé, payé, sous le budget
 *   brique — refusé, impayé, dépassement
 */
export type Ton = "neutre" | "indigo" | "ocre" | "vert" | "brique";

const TONS: Record<Ton, string> = {
  neutre: "text-muted-foreground bg-muted",
  indigo: "text-indigo bg-indigo/15",
  ocre: "text-ocre bg-ocre/15",
  vert: "text-vert bg-vert/15",
  brique: "text-brique bg-brique/15",
};

/**
 * La pastille de statut : un point, un mot.
 *
 * Le point n'est pas décoratif — il donne la couleur sa forme la plus lisible
 * (une tache pleine) tout en laissant le mot porter le sens. Une pastille qui
 * ne serait QUE colorée exclurait les daltoniens et ne se lirait pas sur un
 * export imprimé en noir et blanc ; d'où la règle : le statut s'écrit toujours
 * en toutes lettres, la couleur ne fait que le confirmer.
 */
export function PastilleStatut({
  ton = "neutre",
  children,
  className,
}: {
  ton?: Ton;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1",
        "text-xs font-medium whitespace-nowrap",
        TONS[ton],
        className,
      )}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-current"
      />
      {children}
    </span>
  );
}
