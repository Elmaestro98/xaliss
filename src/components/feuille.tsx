import { cn } from "@/lib/utils";

/**
 * La feuille — la carte de Xaalis, et la seule.
 *
 * Aucune ombre portée nulle part dans l'application : une ombre suppose une
 * source de lumière, et un cahier n'en a pas. Une feuille posée sur le registre
 * se signale par deux choses seulement — son ton (un cran au-dessus du fond)
 * et son filet de réglure à 1px. C'est ce qui tient l'écran ensemble la nuit,
 * où une ombre noire sur fond noir ne se verrait de toute façon pas.
 *
 * Le titre est facultatif : certaines feuilles ne portent qu'un contenu (un
 * formulaire, un état vide). Un en-tête vide vaut moins que pas d'en-tête.
 */
export function Feuille({
  titre,
  mention,
  action,
  children,
  className,
  contenuClassName,
}: {
  titre?: React.ReactNode;
  /** La précision sous le titre : une période, un décompte, une unité. */
  mention?: React.ReactNode;
  /** Ce qui vit à droite du titre : un bouton, un sélecteur de période. */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  contenuClassName?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-reglure bg-card",
        className,
      )}
    >
      {(titre || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5">
          <div className="min-w-0">
            {titre && (
              <h2 className="text-sm font-medium text-foreground">{titre}</h2>
            )}
            {mention && <p className="mention mt-1">{mention}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}

      <div
        className={cn(
          "px-4 py-4 md:px-5 md:py-5",
          (titre || action) && "pt-4 md:pt-4",
          contenuClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}
