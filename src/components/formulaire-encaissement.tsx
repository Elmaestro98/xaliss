"use client";

import { useActionState, useState } from "react";
import { useRetourAction } from "@/hooks/use-retour-action";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type EtatEncaissement,
  rejeterDeclaration,
  validerEncaissement,
} from "@/app/editeur/actions";
import { formatFCFA } from "@/lib/format";

/**
 * Valider ou rejeter une déclaration de paiement, depuis la console éditeur.
 *
 * Le champ « montant constaté » n'est **pas** prérempli avec le montant
 * attendu, et c'est le cœur du dispositif. Prérempli, il transformerait la
 * confrontation en un clic — et un clic ne vérifie rien. L'éditeur doit lire
 * la somme sur Wave Business et la retaper : c'est cette retranscription qui
 * fait le rapprochement.
 *
 * La boîte de dialogue **annonce l'écart avant qu'il ne soit commis**. Le
 * serveur refuserait de toute façon d'activer sur un montant différent, mais
 * il le ferait en marquant le paiement en échec — donc en obligeant le client
 * à tout redéclarer pour une faute de frappe. Mieux vaut le dire avant.
 *
 * La référence est figée côté serveur par `bind` : elle ne transite pas par un
 * champ du formulaire, où elle serait remplaçable depuis la console du
 * navigateur.
 */
export function FormulaireEncaissement({
  reference,
  entreprise,
  montantAttendu,
}: {
  reference: string;
  entreprise: string;
  montantAttendu: number;
}) {
  const [etatValidation, validerAction, validationEnCours] = useActionState<
    EtatEncaissement,
    FormData
  >(validerEncaissement.bind(null, reference), {});

  const [etatRejet, rejeterAction, rejetEnCours] = useActionState<
    EtatEncaissement,
    FormData
  >(rejeterDeclaration.bind(null, reference), {});

  const [montantSaisi, setMontantSaisi] = useState("");

  // Un toast pour la réussite, l'affichage sous le formulaire pour l'échec :
  // un écart de montant doit rester lisible le temps de le corriger, pas
  // s'effacer au bout de quatre secondes.
  useRetourAction(etatValidation);
  useRetourAction(etatRejet);

  const etat = etatValidation.message ? etatValidation : etatRejet;
  const occupe = validationEnCours || rejetEnCours;

  const constate = Number(montantSaisi);
  const saisieValide = montantSaisi !== "" && Number.isFinite(constate);
  const ecart = saisieValide && constate !== montantAttendu;

  // Le contenu de la boîte est rendu dans un portail, donc HORS du <form>.
  // L'attribut `form` est ce qui relie quand même le bouton au formulaire.
  const idFormulaire = `encaissement-${reference}`;

  return (
    <div className="mt-4 rounded-lg border border-reglure bg-muted/40 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <form
          id={idFormulaire}
          action={validerAction}
          className="flex flex-wrap items-end gap-3"
        >
          <div>
            <Label htmlFor={`montant-${reference}`}>
              Montant constaté sur Wave
            </Label>
            <Input
              id={`montant-${reference}`}
              name="montantRecu"
              type="number"
              inputMode="numeric"
              required
              value={montantSaisi}
              onChange={(evenement) => setMontantSaisi(evenement.target.value)}
              placeholder={`${montantAttendu}`}
              aria-describedby={`aide-${reference}`}
              className="chiffre mt-1.5 w-40"
            />
          </div>
        </form>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" disabled={occupe || !saisieValide} className="h-9">
              {validationEnCours ? "Encaissement…" : "Encaisser"}
            </Button>
          </AlertDialogTrigger>

          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {ecart ? "Les montants ne correspondent pas" : "Encaisser ce paiement ?"}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    {entreprise} — référence{" "}
                    <span className="code-compte">{reference}</span>
                  </p>

                  <dl className="space-y-1">
                    <div className="flex justify-between gap-4">
                      <dt>Attendu</dt>
                      <dd className="chiffre">{formatFCFA(montantAttendu)}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Constaté sur Wave</dt>
                      <dd className={`chiffre ${ecart ? "text-brique" : ""}`}>
                        {saisieValide ? formatFCFA(constate) : "—"}
                      </dd>
                    </div>
                  </dl>

                  {ecart ? (
                    <p className="text-brique">
                      Confirmer marquera ce paiement <strong>en échec</strong>{" "}
                      sans activer l&apos;abonnement, et le client devra
                      redéclarer. Corrigez le montant si c&apos;est une faute de
                      frappe.
                    </p>
                  ) : (
                    <p>L&apos;abonnement sera activé immédiatement.</p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button type="submit" form={idFormulaire}>
                  {ecart ? "Marquer en échec" : "Confirmer l'encaissement"}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <RejeterDeclaration
          reference={reference}
          entreprise={entreprise}
          action={rejeterAction}
          enCours={rejetEnCours}
          occupe={occupe}
        />
      </div>

      <p id={`aide-${reference}`} className="mt-2 text-xs text-muted-foreground">
        Attendu : <span className="chiffre">{formatFCFA(montantAttendu)}</span>.
        Un écart marque le paiement en échec sans activer l&apos;abonnement.
      </p>

      {etat.message && etat.ton === "brique" && (
        <p role="alert" className="mt-2 text-sm text-brique">
          {etat.message}
        </p>
      )}
    </div>
  );
}

/** Le rejet a sa propre confirmation : il oblige le client à tout redéclarer. */
function RejeterDeclaration({
  reference,
  entreprise,
  action,
  enCours,
  occupe,
}: {
  reference: string;
  entreprise: string;
  action: (formData: FormData) => void;
  enCours: boolean;
  occupe: boolean;
}) {
  const idFormulaire = `rejet-${reference}`;

  return (
    <>
      <form id={idFormulaire} action={action} />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            disabled={occupe}
            className="h-9 text-muted-foreground hover:bg-brique/10 hover:text-brique"
          >
            {enCours ? "Rejet…" : "Rejeter"}
          </Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeter cette déclaration ?</AlertDialogTitle>
            <AlertDialogDescription>
              {entreprise} — référence {reference}. Le paiement passera en
              échec et le client devra déclarer à nouveau. À faire lorsque
              aucun versement correspondant n&apos;apparaît sur Wave Business.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                type="submit"
                form={idFormulaire}
                variant="destructive"
              >
                Rejeter
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
