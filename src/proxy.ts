import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Rend la session Clerk disponible a l'application. La protection des routes,
 * elle, se fait dans chaque page via requireSession() (voir lib/session.ts) :
 * Clerk deconseille desormais le filtrage par URL dans le middleware, qui peut
 * diverger du routage reel de Next.js et laisser une page accessible.
 *
 * signInUrl / signUpUrl gardent l'utilisateur dans Xaalis : sans eux, Clerk
 * renvoie vers ses pages hebergees sur accounts.dev.
 */
export default clerkMiddleware({
  signInUrl: "/sign-in",
  signUpUrl: "/sign-up",
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
