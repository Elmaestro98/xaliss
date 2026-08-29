import { ImageResponse } from "next/og";
import { glyphePWA } from "@/lib/icone-app";

/**
 * iOS n'utilise pas le manifest.webmanifest pour l'icône d'écran d'accueil :
 * il lui faut cette convention réservée (`apple-icon`), qui pose elle-même
 * la balise `<link rel="apple-touch-icon">`. 180×180 est la taille conseillée
 * par Apple pour couvrir les écrans Retina.
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(glyphePWA(180), size);
}
