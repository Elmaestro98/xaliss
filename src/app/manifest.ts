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
    // Fond de l'écran de démarrage et couleur système : accordés au thème
    // sombre par défaut (§6 PROJET.md — « le cahier, la nuit »), pas à
    // l'ancienne palette claire.
    background_color: "#0b0d12",
    theme_color: "#0b0d12",
    // Le vrai logo (public/logosombre.jpg d'origine, recadré en carré) —
    // remplace l'ancien monogramme généré par code.
    icons: [
      {
        src: "/marque/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/marque/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/marque/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
