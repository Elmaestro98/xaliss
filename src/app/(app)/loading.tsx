/**
 * L'écran d'attente de toutes les pages du groupe (app).
 *
 * Il ne rend rien plus rapide — il rend l'attente lisible. Sans lui, cliquer
 * sur « Dépenses » ne produit RIEN à l'écran tant que la page n'est pas prête :
 * l'ancienne page reste affichée, figée, et le produit paraît cassé bien plus
 * que lent. Next.js n'affiche cette limite que si le fichier existe (voir
 * `node_modules/next/dist/docs/.../file-conventions/loading.md`) ; c'est son
 * absence qui coûtait le plus cher au ressenti.
 *
 * La barre latérale, elle, reste utilisable pendant ce temps : elle vit dans le
 * layout, au-dessus de cette limite. On peut donc changer d'avis en cours de
 * route sans attendre la page qu'on vient de quitter.
 *
 * Le motif n'est pas un squelette gris de bibliothèque, c'est celui du projet :
 * la réglure du registre, encore sans encre (PROJET.md §6). Une donnée qui
 * n'est pas là n'est pas grisée — elle n'est simplement pas encore écrite.
 */
export default function Chargement() {
  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10"
      aria-busy="true"
    >
      {/* Le lecteur d'écran annonce ce que l'œil comprend déjà. */}
      <span className="sr-only">Chargement de la page…</span>

      {/* Le titre de la page, pas encore écrit. */}
      <div className="h-8 w-52 animate-pulse rounded-lg bg-muted md:h-9 md:w-64" />

      {/* La feuille du haut porte le montant héros : un seul par écran. */}
      <section className="mt-6 rounded-xl border border-reglure bg-card p-4 md:p-5">
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-10 w-48 animate-pulse rounded-lg bg-muted md:h-12 md:w-64" />
      </section>

      {/* Les feuilles du dessous : des rangées qui se posent sur la réglure. */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {[0, 1].map((feuille) => (
          <section
            key={feuille}
            className="rounded-xl border border-reglure bg-card p-4 md:p-5"
          >
            <div className="h-3 w-28 animate-pulse rounded bg-muted" />
            {/* 4 rangées de 2.75rem : la hauteur de ligne du registre. */}
            <div className="papier-regle mt-4 h-44" />
          </section>
        ))}
      </div>
    </div>
  );
}
