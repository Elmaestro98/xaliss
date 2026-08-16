"use client";

import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supprimerDepense } from "@/app/(app)/depenses/actions";
import { formatFCFA } from "@/lib/format";

/**
 * Supprimer une ligne du journal. Le geste est définitif côté comptable — la
 * confirmation rappelle donc le montant, pas seulement « êtes-vous sûr ? » :
 * c'est le montant qui permet de reconnaître la bonne ligne.
 *
 * Le contenu supprimé reste dans AuditLog (PROJET.md §10).
 *
 * Le `confirm()` du navigateur a été remplacé par une vraie boîte : il
 * s'affichait dans la langue du système et non celle de l'application, et sur
 * un téléphone Android il ressemble à une alerte de sécurité — la dernière
 * chose qu'on veut avant un geste comptable irréversible.
 */
export function BoutonSupprimerDepense({
  id,
  montant,
  libelle,
}: {
  id: string;
  montant: number;
  libelle: string;
}) {
  // La boîte est rendue dans un portail, hors du <form> : l'attribut `form`
  // est ce qui relie quand même le bouton de confirmation au formulaire.
  const idFormulaire = `suppression-${id}`;

  return (
    <>
      <form id={idFormulaire} action={supprimerDepense.bind(null, id)} />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:bg-brique/10 hover:text-brique"
          >
            <Trash2 className="size-4" aria-hidden />
            Supprimer
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  <span className="font-medium text-foreground">{libelle}</span>
                  {" — "}
                  <span className="chiffre text-foreground">
                    {formatFCFA(montant)}
                  </span>
                </p>
                <p>
                  Le justificatif joint sera effacé avec elle. La suppression
                  reste tracée dans le journal d&apos;audit.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="submit" form={idFormulaire} variant="destructive">
                Supprimer définitivement
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
