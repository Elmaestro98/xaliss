"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** La clé de stockage, partagée avec le script d'amorçage du layout racine. */
export const CLE_THEME = "xaalis-theme";

/**
 * Basculer entre la nuit et le jour.
 *
 * Ce n'est pas un réglage de confort : un employé qui saisit un reçu dehors,
 * en plein soleil de Saint-Louis, ne lit pas un écran noir. C'est pour ça que
 * la bascule vit dans la coque de l'application et non enterrée dans les
 * paramètres — on en a besoin sur le terrain, pas au bureau.
 *
 * Aucun état React, aucun contexte, aucune bibliothèque. Le thème EST la
 * classe `dark` sur `<html>` : la lire, c'est interroger le DOM ; la changer,
 * c'est basculer la classe. Un état React en doublon ne pourrait que diverger
 * de la seule chose qui décide vraiment de la couleur des pixels.
 *
 * L'icône aussi est choisie par CSS (`dark:`), pas par JavaScript. Au rendu
 * serveur le thème actif n'est pas connu ; le résoudre en JS imposerait
 * d'attendre l'hydratation, donc d'afficher un trou à la place du bouton.
 */
export function BasculeTheme({ className }: { className?: string }) {
  function basculer() {
    const racine = document.documentElement;
    const versLaNuit = !racine.classList.contains("dark");

    racine.classList.toggle("dark", versLaNuit);

    // Le mode privé de Safari fait échouer l'écriture. Le thème s'applique
    // quand même pour cette visite — il ne sera simplement pas retenu.
    try {
      localStorage.setItem(CLE_THEME, versLaNuit ? "dark" : "light");
    } catch {
      // Sans mémoire, mais pas sans thème.
    }
  }

  return (
    <button
      type="button"
      onClick={basculer}
      // Un libellé unique, vrai dans les deux sens : décrire l'état cible
      // (« passer en clair ») obligerait à connaître l'état courant côté
      // serveur, ce qui est précisément ce qu'on évite ici.
      aria-label="Changer de thème"
      title="Changer de thème"
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-lg",
        "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
    </button>
  );
}
