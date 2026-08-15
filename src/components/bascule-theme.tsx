"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Basculer entre la nuit et le jour.
 *
 * Ce n'est pas un réglage de confort : un employé qui saisit un reçu dehors,
 * en plein soleil de Saint-Louis, ne lit pas un écran noir. C'est pour ça que
 * la bascule vit dans la coque de l'application et non enterrée dans les
 * paramètres — on en a besoin sur le terrain, pas au bureau.
 *
 * L'icône est choisie par CSS (`dark:`), pas par l'état React. Au rendu
 * serveur le thème actif n'est pas connu : le résoudre en JavaScript
 * imposerait d'attendre l'hydratation, donc d'afficher un trou à la place du
 * bouton. La classe `dark` est déjà posée sur `<html>` avant la première
 * peinture — laisser CSS trancher rend le bon icône du premier coup.
 */
export function BasculeTheme({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
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
