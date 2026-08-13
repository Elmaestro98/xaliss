import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Xaalis — gestion des dépenses",
    short_name: "Xaalis",
    description:
      "Suivez les dépenses, budgets et notes de frais de votre entreprise, en FCFA.",
    lang: "fr",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#eef1f7",
    theme_color: "#131720",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
