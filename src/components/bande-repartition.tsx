import { formatFCFA } from "@/lib/format";
export type Segment = {
  id: string;
  nom: string;
  code: string | null;
  couleur: string;
  montant: number;
};

/**
 * « La bande » — la répartition du mois en un seul objet, à l'échelle du total
 * affiché juste au-dessus. Les codes SYSCOHADA servent de numéros de structure :
 * ce sont de vrais numéros de compte, pas des marqueurs décoratifs.
 */
export function BandeRepartition({
  segments,
  total,
}: {
  segments: Segment[];
  total: number;
}) {
  if (total <= 0 || segments.length === 0) {
    return (
      <div className="mt-5 flex h-11 items-center justify-center border border-dashed border-reglure bg-card">
        <p className="text-sm text-muted-foreground">
          La bande se remplit dès la première dépense.
        </p>
      </div>
    );
  }

  // Le top 5 ne couvre pas forcément tout : sans ce reste, la bande mentirait
  // sur les proportions.
  const couvert = segments.reduce((somme, s) => somme + s.montant, 0);
  const reste = Math.max(0, total - couvert);

  const part = (montant: number) => (montant / total) * 100;

  return (
    <div className="mt-5">
      <div
        role="img"
        aria-label={`Répartition des dépenses du mois : ${segments
          .map((s) => `${s.nom}, ${formatFCFA(s.montant)}`)
          .join(
            " ; ",
          )}${reste > 0 ? ` ; autres catégories, ${formatFCFA(reste)}` : ""}`}
        className="flex h-11 w-full overflow-hidden rounded-sm border border-reglure"
      >
        {segments.map((segment) => (
          <div
            key={segment.id}
            style={{
              width: `${part(segment.montant)}%`,
              backgroundColor: segment.couleur,
            }}
          />
        ))}
        {reste > 0 && (
          <div style={{ width: `${part(reste)}%` }} className="bg-muted" />
        )}
      </div>

      {/* La légende se pose sur la réglure : chaque ligne fait une hauteur de
          ligne du cahier (2.75rem). */}
      <ul className="papier-regle mt-4 border-y border-reglure bg-card">
        {segments.map((segment) => (
          <li
            key={segment.id}
            className="flex h-11 items-center gap-3 px-3 text-sm"
          >
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: segment.couleur }}
            />
            <span className="code-compte w-10 shrink-0 text-muted-foreground">
              {segment.code ?? "—"}
            </span>
            <span className="min-w-0 flex-1 truncate">{segment.nom}</span>
            <span className="code-compte hidden w-12 text-right text-muted-foreground sm:block">
              {Math.round(part(segment.montant))} %
            </span>
            <span className="chiffre shrink-0 text-right font-medium">
              {formatFCFA(segment.montant)}
            </span>
          </li>
        ))}
        {reste > 0 && (
          <li className="flex h-11 items-center gap-3 px-3 text-sm text-muted-foreground">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[2px] bg-muted"
            />
            <span className="code-compte w-10 shrink-0">—</span>
            <span className="min-w-0 flex-1 truncate">Autres catégories</span>
            <span className="code-compte hidden w-12 text-right sm:block">
              {Math.round(part(reste))} %
            </span>
            <span className="chiffre shrink-0 text-right">
              {formatFCFA(reste)}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
