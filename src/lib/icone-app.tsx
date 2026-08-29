import type { CSSProperties, ReactElement } from "react";

/**
 * Le glyphe de l'app, partagé par toutes les tailles d'icône PWA — un seul
 * dessin, pour que le X reste identique sur l'écran d'accueil du téléphone,
 * l'onglet du navigateur et l'écran de démarrage.
 *
 * `safe` réserve la marge que les OS Android appliquent aux icônes
 * "maskable" : ils rognent jusqu'à ~20 % des bords selon la forme du masque
 * (cercle, carré arrondi…) — sans cette marge, le X serait coupé sur
 * certains téléphones.
 */
export function glyphePWA(
  taille: number,
  { safe = false }: { safe?: boolean } = {},
): ReactElement {
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0b0d12",
  };
  return (
    <div style={style}>
      <span
        style={{
          fontSize: Math.round(taille * (safe ? 0.42 : 0.58)),
          fontWeight: 700,
          color: "#7c8cf8",
          fontFamily: "sans-serif",
          lineHeight: 1,
        }}
      >
        X
      </span>
    </div>
  );
}
