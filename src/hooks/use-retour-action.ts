"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * L'état de retour d'une action serveur, dans ses deux conventions.
 *
 * `succes` est le drapeau des formulaires de l'application, `ton` celui de la
 * console éditeur. Les deux disent la même chose ; ce type les accepte plutôt
 * que d'imposer une migration de douze fichiers pour un booléen.
 */
type EtatAction = {
  message?: string;
  succes?: boolean;
  ton?: "vert" | "brique";
};

/**
 * Un toast quand l'action a réussi — et seulement là.
 *
 * Les erreurs restent affichées à côté du champ fautif, volontairement. Un
 * toast disparaît au bout de quelques secondes : c'est très bien pour une
 * confirmation qu'on peut manquer sans conséquence, et très mauvais pour un
 * message qu'il faut lire pour corriger une saisie.
 *
 * L'effet dépend de l'objet d'état entier, pas de son message : `useActionState`
 * renvoie un nouvel objet à chaque exécution, donc deux réussites successives
 * au message identique déclenchent bien deux toasts.
 */
export function useRetourAction(etat: EtatAction) {
  useEffect(() => {
    if (!etat.message) return;
    if (etat.succes === true || etat.ton === "vert") {
      toast.success(etat.message);
    }
  }, [etat]);
}
