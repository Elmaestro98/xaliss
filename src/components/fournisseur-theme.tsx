"use client";

import { ThemeProvider } from "next-themes";

/**
 * Le thème de Xaalis.
 *
 * `enableSystem` est volontairement à false. « Sombre par défaut » doit
 * vouloir dire sombre pour tout le monde à la première ouverture : suivre le
 * réglage du système ferait démarrer en clair la moitié des utilisateurs, et
 * la direction visuelle (PROJET.md §6) ne serait plus celle que voit le
 * client, seulement celle qu'on a écrite.
 *
 * Le passage en clair reste un geste explicite — voir `BasculeTheme`.
 */
export function FournisseurTheme({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
