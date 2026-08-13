import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Xaalis
        </h1>
        <p className="mt-4 max-w-md text-lg text-zinc-600 dark:text-zinc-400">
          Plateforme de gestion des dépenses pour PME sénégalaises.
        </p>

        <Show when="signed-out">
          <div className="mt-8 flex gap-4">
            <Link
              href="/sign-in"
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Connexion
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            >
              Créer un compte
            </Link>
          </div>
        </Show>

        <Show when="signed-in">
          <div className="mt-8 flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Tableau de bord
            </Link>
            <UserButton />
          </div>
        </Show>
      </main>
    </div>
  );
}
