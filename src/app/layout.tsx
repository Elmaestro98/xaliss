import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { frFR } from "@clerk/localizations";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { FournisseurTheme } from "@/components/fournisseur-theme";
import "./globals.css";

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
  return (
    <ClerkProvider
      localization={frFR}
      appearance={apparenceClerk}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      {/*
        `dark` est écrit ici, au rendu serveur, plutôt que laissé à
        next-themes : sans cela la première image peinte est claire, et l'écran
        blanchit une fraction de seconde avant de basculer. next-themes reprend
        la main dès l'hydratation — d'où `suppressHydrationWarning`, qui est la
        façon prévue de dire à React que cet attribut change côté client.
      */}
      <html
        lang="fr"
        className={`dark ${archivo.variable} ${plexMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="flex min-h-full flex-col">
          <FournisseurTheme>{children}</FournisseurTheme>
        </body>
      </html>
    </ClerkProvider>
  );
}
