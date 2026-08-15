/**
 * La réglure, en SVG.
 *
 * `globals.css` porte déjà le motif pour le HTML (`.regle-texture`), mais
 * recharts dessine en SVG : un `background-image` n'y entre pas. Ce motif est
 * donc le même trait, redéclaré dans la seule autre langue de l'application.
 *
 * Il sert à une chose : remplir ce qui n'est PAS le sujet. Une donnée
 * secondaire n'est pas grisée, elle est réglée — elle reste du papier, elle
 * n'est simplement pas encore écrite. Voir globals.css §3.
 */
export const ID_MOTIF_REGLURE = "xaalis-reglure";

export function MotifReglure({ id = ID_MOTIF_REGLURE }: { id?: string }) {
  return (
    <pattern
      id={id}
      width="6"
      height="6"
      patternUnits="userSpaceOnUse"
      // Sans cela, le motif se décale avec la barre et les lignes de deux
      // barres voisines ne s'alignent plus : on verrait des marches d'escalier
      // là où le cahier a des lignes continues.
      patternContentUnits="userSpaceOnUse"
    >
      <rect width="6" height="6" fill="var(--pose)" />
      <path
        d="M0 5.5 H6"
        stroke="var(--reglure)"
        strokeWidth="1"
        shapeRendering="crispEdges"
      />
    </pattern>
  );
}

/** À passer en `fill` d'une forme SVG pour la remplir de papier réglé. */
export const REMPLISSAGE_REGLURE = `url(#${ID_MOTIF_REGLURE})`;
