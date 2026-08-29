import { ImageResponse } from "next/og";
import { glyphePWA } from "@/lib/icone-app";

export const contentType = "image/png";
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(glyphePWA(512), { width: 512, height: 512 });
}
