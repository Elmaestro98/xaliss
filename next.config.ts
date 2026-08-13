import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Les justificatifs partent dans le corps de la Server Action : la
      // limite par défaut (1 Mo) est trop basse pour une photo de téléphone.
      // 12 Mo = fichier de 10 Mo maximum + marge multipart (voir la doc
      // serverActions.md : compter 10-20 Ko de plus que le fichier).
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
