import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { Suspense } from "react";
import { CLE_THEME } from "@/components/bascule-theme";
import { ToastSucces } from "@/components/toast-succes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * Le thème, avant la première image peinte.
 *
 * `<html>` part déjà en `dark` (voir plus bas) : ce script ne sert qu'à
 * rendre son choix à qui a demandé le clair. Il doit s'exécuter avant que le
 * navigateur ne peigne quoi que ce soit, sinon l'écran blanchit une fraction
 * de seconde avant de basculer — d'où sa place en tête de `<body>`, en
 * synchrone, et non dans un composant React.
 *
 * Écrit à la main plutôt que délégué à next-themes : la bibliothèque rend ce
 * même script DEPUIS un composant client, ce que React 19 signale comme une
 * erreur (« Encountered a script tag while rendering React component »). Pour
 * deux thèmes et une classe, trente lignes valent mieux qu'une dépendance qui
 * se bat avec le moteur de rendu.
 */
const SCRIPT_THEME = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  CLE_THEME,
)});if(c==="light"){document.documentElement.classList.remove("dark")}}catch(e){}})()`;

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Xaalis — gestion des dépenses",
  description:
    "Suivez les dépenses, budgets et notes de frais de votre entreprise, en FCFA.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  // Le fond de la nuit : la barre du navigateur prolonge la page au lieu de
  // poser un bandeau clair au-dessus d'elle. Xaalis démarre en sombre.
  themeColor: "#0b0d12",
};

/**
 * Les couleurs de Clerk, accordées aux nôtres.
 *
 * Ses écrans (connexion, changement d'entreprise, menu du compte) ne sont pas
 * les nôtres, mais ils s'ouvrent au milieu des nôtres : laissés par défaut,
 * ils apparaissent en blanc au milieu de la nuit. On lui passe donc nos
 * variables CSS, qui suivent d'elles-mêmes le thème actif.
 */
const apparenceClerk = {
  variables: {
    colorPrimary: "var(--indigo)",
    colorPrimaryForeground: "var(--primary-foreground)",
    colorBackground: "var(--feuille)",
    colorForeground: "var(--encre)",
    colorMuted: "var(--pose)",
    colorMutedForeground: "var(--encre-pale)",
    colorInput: "var(--pose)",
    colorInputForeground: "var(--encre)",
    colorBorder: "var(--reglure)",
    colorRing: "var(--indigo)",
    colorDanger: "var(--brique)",
    colorSuccess: "var(--vert)",
    colorWarning: "var(--ocre)",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-archivo)",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Après connexion, on passe par un aiguillage (`/apres-connexion`) :
  // l'éditeur va vers sa console, les clients vers leur tableau de bord. Une
  // inscription, elle, ne peut pas être celle de l'éditeur — droit au
  // tableau de bord.
  return (
    <ClerkProvider
      localization={frFR}
      appearance={apparenceClerk}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/apres-connexion"
      signUpFallbackRedirectUrl="/dashboard"
    >
      {/*
        `dark` est écrit ici, au rendu serveur : c'est le thème par défaut de
        Xaalis, et le poser dès le HTML évite l'éclair blanc d'un écran qui
        démarre clair avant de basculer. `suppressHydrationWarning` est la
        façon prévue de dire à React que cet attribut peut différer côté
        client — le script ci-dessous l'y modifie avant l'hydratation.
      */}
      <html
        lang="fr"
        className={`dark ${archivo.variable} ${plexMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="flex min-h-full flex-col">
          <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
          {children}

          {/*
            Le toaster vit à la racine, pas dans le groupe (app) : la console
            éditeur et la page d'accueil sont en dehors, et une confirmation
            qui ne s'affiche que sur la moitié des pages est un piège pour le
            prochain qui ajoutera une action.

            `Suspense` est requis autour de `useSearchParams` — sans lui,
            Next.js refuse de rendre la page statiquement le jour où l'une
            d'elles cessera d'être dynamique.
          */}
          <Suspense fallback={null}>
            <ToastSucces />
          </Suspense>
          <Toaster position="top-center" />
        </body>
      </html>
    </ClerkProvider>
  );
}
