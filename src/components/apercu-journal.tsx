/**
 * L'aperçu du journal — l'image du héros de la page d'accueil, et le seul
 * moment animé du site.
 *
 * À l'ouverture, la page **tient le cahier devant vous** : le trait du
 * registre se tire d'abord de gauche à droite, puis les mois poussent dessus
 * l'un après l'autre, et le mois courant arrive en dernier, à l'encre. C'est
 * l'argument de la page joué plutôt qu'écrit — on ne dit pas « c'est un
 * cahier », on le remplit.
 *
 * L'ordre est le seul possible : régler la feuille, puis écrire. Faire pousser
 * les barres avant le trait montrerait des chiffres suspendus dans le vide.
 *
 * C'est aussi le seul endroit de Xaalis où des chiffres inventés s'affichent.
 * Ils illustrent l'outil, ils ne prétendent pas être des données : d'où le
 * `role="img"` et sa description, qui disent à un lecteur d'écran qu'il
 * regarde un exemple et non le journal de son entreprise.
 */

/** Hauteurs en pourcentage de la plus haute barre — un semestre plausible. */
const MOIS = [
  { label: "Jan", hauteur: 62 },
  { label: "Fév", hauteur: 48 },
  { label: "Mar", hauteur: 78 },
  { label: "Avr", hauteur: 55 },
  { label: "Mai", hauteur: 88 },
  // Le mois courant est plus bas : on est au milieu du mois, pas à sa fin.
  // Une barre pleine hauteur ferait croire à un mois terminé.
  { label: "Juin", hauteur: 52, courant: true },
];

/** Le trait se tire, puis les mois s'écrivent — 120 ms d'écart entre deux mois. */
const RETARD_TRAIT = 260;
const RETARD_PREMIER_MOIS = 500;
const ECART_ENTRE_MOIS = 110;

function retard(ms: number) {
  return { "--retard": `${ms}ms` } as React.CSSProperties;
}

export function ApercuJournal() {
  return (
    <div
      role="img"
      aria-label="Exemple de tableau de bord Xaalis : 2 847 500 FCFA dépensés ce mois, en baisse de 8 % par rapport au mois précédent, avec l'évolution des six derniers mois."
      className="w-full rounded-xl border border-reglure bg-card p-5 sm:p-6 lg:p-8"
    >
      <p className="mention anim-monte">Total dépensé ce mois</p>

      <div
        className="anim-monte mt-2 flex flex-wrap items-end gap-x-3 gap-y-2"
        style={retard(90)}
      >
        <span className="chiffre-affichage">2 847 500</span>
        <span className="mention pb-1.5">FCFA</span>
        {/*
          Baisse = vert. On compte des DÉPENSES : dépenser moins que le mois
          dernier est une bonne nouvelle. L'inverse d'un tableau de bord de
          chiffre d'affaires — voir PROJET.md §6.
        */}
        <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-vert/15 px-2 py-0.5 text-xs font-medium text-vert">
          <span aria-hidden>▼</span>
          <span className="chiffre">8 %</span>
        </span>
      </div>

      <div className="mt-7">
        <div className="relative flex h-40 items-end gap-2 sm:h-48 sm:gap-3 lg:h-56">
          {/* Le trait du registre. Il arrive avant tout le reste. */}
          <span
            aria-hidden
            className="anim-trait absolute inset-x-0 bottom-0 h-px bg-reglure"
            style={retard(RETARD_TRAIT)}
          />

          {MOIS.map((mois, index) => (
            <div
              key={mois.label}
              style={{
                height: `${mois.hauteur}%`,
                ...retard(RETARD_PREMIER_MOIS + index * ECART_ENTRE_MOIS),
              }}
              className={
                mois.courant
                  ? "anim-pousse min-w-0 flex-1 rounded-t-md bg-indigo"
                  : "regle-texture anim-pousse min-w-0 flex-1 rounded-t-md border border-b-0 border-reglure"
              }
            />
          ))}
        </div>

        <div className="mt-2.5 flex gap-2 sm:gap-3">
          {MOIS.map((mois, index) => (
            <span
              key={mois.label}
              style={retard(RETARD_PREMIER_MOIS + index * ECART_ENTRE_MOIS)}
              className={`anim-monte code-compte min-w-0 flex-1 text-center ${
                mois.courant ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {mois.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
