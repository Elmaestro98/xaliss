"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { type CleSucces, MESSAGES_SUCCES } from "@/lib/messages-succes";

/**
 * Le toast des actions qui redirigent.
 *
 * La plupart des actions de Xaalis se terminent par `redirect()` : saisir une
 * dépense renvoie au journal, approuver une note recharge la note. Il n'y a
 * donc aucun état de retour à afficher — la page qui a lancé l'action n'existe
 * déjà plus au moment où elle réussit.
 *
 * Le succès voyage donc dans l'URL, sous forme de clé, et ce composant le
 * transforme en toast puis efface la trace. Sans ce nettoyage, un rafraîchi-
 * ssement ou un retour arrière rejouerait la confirmation d'une action déjà
 * faite — « Dépense enregistrée » alors qu'on n'a rien enregistré.
 *
 * `router.replace` plutôt que `push` : la confirmation ne mérite pas une
 * entrée dans l'historique du navigateur.
 */
export function ToastSucces() {
  const parametres = useSearchParams();
  const chemin = usePathname();
  const router = useRouter();

  const cle = parametres.get("ok");

  useEffect(() => {
    if (!cle) return;

    // Une clé inconnue n'affiche rien : elle vient forcément d'une URL
    // fabriquée à la main, puisque l'application ne produit que ces clés-là.
    const message = MESSAGES_SUCCES[cle as CleSucces];
    if (message) toast.success(message);

    const restants = new URLSearchParams(parametres);
    restants.delete("ok");
    const requete = restants.toString();

    router.replace(requete ? `${chemin}?${requete}` : chemin, {
      scroll: false,
    });
  }, [cle, parametres, chemin, router]);

  return null;
}
