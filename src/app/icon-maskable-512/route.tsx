import { ImageResponse } from "next/og";
import { glyphePWA } from "@/lib/icone-app";

export const contentType = "image/png";
export const dynamic = "force-static";

/**
 * Variante "maskable" : Android peut découper l'icône dans un cercle, un
 * carré arrondi ou un "squircle" selon le lanceur du téléphone. Le X est
 * donc recentré avec une marge de sécurité (voir `glyphePWA`) plutôt que de
 * remplir tout le carré comme les icônes normales.
 */
export function GET() {
  return new ImageResponse(glyphePWA(512, { safe: true }), {
    width: 512,
    height: 512,
  });
}
