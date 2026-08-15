# Prompt Google Stitch — page d'accueil Xaalis

> À coller dans https://stitch.withgoogle.com en mode **Web**.
> Source : `PROJET.md` §1, §3, §6, §11.
> Rédigé le 14 août 2026, après la refonte visuelle « le cahier, la nuit ».

---

## ⚡ Version courte — à envoyer EN PREMIER

Stitch travaille mieux en deux temps : on pose d'abord la direction et la
structure, on affine ensuite section par section. Colle ceci d'abord.

```
Page d'accueil pour Xaalis, plateforme SaaS sénégalaise de gestion des dépenses
pour PME. Tout le texte visible en français. Conception mobile d'abord.

Style « cahier comptable, la nuit » : fond bleu-noir #0B0D12 (pas un gris
neutre), cartes #12151E, bordures 1px #232A3A, texte #E9EDF7, texte secondaire
#8D98B3, accent indigo #7C8CF8, vert #3ECF8E, ocre #E8A33D, rouge #FF6B6B.
Police Archivo, titres très larges et gras avec interlettrage serré. IBM Plex
Mono en majuscules 11px pour les petites étiquettes.
AUCUNE ombre portée, aucun dégradé, aucune lueur, aucun effet de verre. Les
cartes se détachent par leur ton et un filet de 1px. Angles arrondis à 12px.

Sections dans l'ordre : barre de navigation · héros · le problème en 3 cartes ·
4 modules produit · pourquoi c'est local · 3 plans tarifaires · appel à l'action ·
pied de page.

Héros — titre : « Tenez le cahier de vos dépenses, plus la pile de reçus. »
Sous-titre : « Xaalis suit les dépenses, budgets et notes de frais de votre PME.
En FCFA, payable par Wave, sans carte bancaire. »
Boutons : « Essayer 14 jours gratuitement » (plein indigo) et « Voir une
démonstration » (contour discret).

Visuel du héros : capture stylisée d'un tableau de bord affichant un très gros
montant « 2 847 500 » avec « FCFA » en petites capitales à côté, une pastille
verte « ▼ 8 % », et un graphique en barres sur 6 mois. Les barres des mois
passés sont remplies d'un motif de fines lignes horizontales (1px, #232A3A,
tous les 6px) ; la barre du mois courant est en indigo plein #7C8CF8.
```

Ensuite, envoie les sections 3 à 8 ci-dessous une par une en demandant
« affine la section X avec ce contenu ».

---

## CONTEXTE

Je conçois la page d'accueil publique de **Xaalis**, une plateforme SaaS sénégalaise
de gestion des dépenses pour PME. Le nom veut dire « l'argent » en wolof.
**Tout le texte visible doit être en français.**

## PUBLIC

Dirigeants de PME sénégalaises de 5 à 50 employés (commerce, BTP, services,
restauration), leurs comptables, et leurs employés de terrain (commerciaux,
chauffeurs, techniciens). La majorité consulte depuis un téléphone Android
d'entrée de gamme sur un forfait data limité. **Conception mobile d'abord** : la
version téléphone est la vraie, la version bureau en découle.

## POSITIONNEMENT

Alternative locale et abordable à Expensify et Spendesk. Tarifs en FCFA,
abonnement payable par **Wave** sans carte bancaire, interface en français,
catégories comptables **SYSCOHADA**. La page doit donner l'impression d'un outil
fait ici, pas d'un logiciel américain traduit.

## DIRECTION VISUELLE — « le cahier, la nuit »

Xaalis remplace le registre papier des PME. L'interface emprunte la structure du
cahier réglé, vue sous la lampe. Ce n'est pas un dashboard sombre générique.

**Couleurs exactes (thème sombre, par défaut) :**

- Fond de page : `#0B0D12` — un bleu-noir, PAS un gris neutre. C'est la couleur
  de la teinture indigo à pleine profondeur.
- Cartes : `#12151E`
- Surface posée sur une carte (champ, segment) : `#1A1F2B`
- Filets et bordures : `#232A3A`, toujours 1 pixel
- Texte : `#E9EDF7` — texte secondaire : `#8D98B3`
- Accent de marque (indigo) : `#7C8CF8`
- Vert (validé, sous budget) : `#3ECF8E`
- Ocre (alerte) : `#E8A33D`
- Rouge brique (dépassement) : `#FF6B6B`

**Règles non négociables :**

- **Aucune ombre portée, nulle part.** Une ombre suppose une source de lumière ;
  un cahier n'en a pas. Une carte se détache par son ton et son filet de 1px.
- **Aucun dégradé de marque**, aucun effet de verre, aucune lueur néon.
- Rayon des angles : **12 pixels** sur les cartes, arrondi assumé mais pas mou.
- **Pas de couleur cyan ni orange dans le décor.** Ces deux couleurs sont
  réservées aux logos Wave et Orange Money quand ils apparaissent comme données.

**Typographie :**

- Une seule famille : **Archivo** (variable). Les titres utilisent son axe de
  largeur (font-stretch 118 %, graisse 800, interlettrage serré) — le contraste
  vient de la largeur, pas d'une deuxième police.
- **IBM Plex Mono** uniquement pour les numéros de compte comptables et les
  petites capitales d'étiquette (interlettrage large, majuscules, 11px).
- Les montants sont en chiffres tabulaires, format français avec espaces :
  « 1 250 000 FCFA ».

**Motif signature — la réglure :**
Un motif de fines lignes horizontales (1px, `#232A3A`, tous les 6 pixels) qui
remplit ce qui n'est PAS le sujet. Une donnée secondaire n'est pas grisée, elle
est réglée : elle reste du papier, elle n'est simplement pas encore écrite.
Utilise-le dans les visuels de graphiques.

## STRUCTURE DE LA PAGE

### 1. Barre de navigation

Logo « Xaalis » en titre large à gauche. Liens : Fonctionnalités, Tarifs,
Connexion. Bouton plein indigo à droite : « Essayer 14 jours ».
Sur téléphone : logo + menu hamburger + le bouton.

### 2. Section héros

Titre : **« Tenez le cahier de vos dépenses, plus la pile de reçus. »**

Sous-titre : « Xaalis suit les dépenses, budgets et notes de frais de votre PME.
En FCFA, payable par Wave, sans carte bancaire. »

Deux boutons : « Essayer 14 jours gratuitement » (plein indigo) et
« Voir une démonstration » (contour discret).

Sous les boutons, en petit et gris : « Sans engagement · Sans carte bancaire ·
Interface en français »

**Visuel du héros :** une capture stylisée du tableau de bord Xaalis, dans les
couleurs ci-dessus. On y voit un très gros montant (« 2 847 500 » avec
« FCFA » en petites capitales à côté), une pastille verte « ▼ 8 % » à côté, et
un graphique en barres sur 6 mois où **les barres des mois passés sont remplies
du motif de lignes horizontales** et **la barre du mois courant est en indigo
plein `#7C8CF8`**. C'est l'image la plus importante de la page.

### 3. Le problème

Titre : « Aujourd'hui, ça se passe comme ça. »
Trois cartes courtes, ton factuel, sans dramatiser :

- **Le reçu au fond de la poche** — « Il est froissé, illisible, ou perdu. Au
  moment du bilan, la dépense n'existe plus. »
- **Le budget dépassé la semaine dernière** — « Personne ne l'a vu passer. On
  l'apprend en fin de mois, quand il est trop tard pour corriger. »
- **Le bilan qui prend trois jours** — « Recopier Excel, retrouver les
  justificatifs, tout recompter à la main. »

### 4. Les quatre modules

Titre : « Ce que Xaalis fait à la place. »
Quatre cartes avec une icône fine au trait, un titre court, deux lignes :

- **Dépenses** — « Photographiez le reçu, Xaalis lit le montant, la date et le
  fournisseur. Vous validez, c'est enregistré. »
- **Budgets** — « Une jauge par catégorie. Alerte par e-mail à 80 % et à 100 %,
  avant le dépassement, pas après. »
- **Notes de frais** — « L'employé soumet depuis son téléphone. Vous approuvez
  d'un geste. Chaque décision est tracée. »
- **Rapports** — « Journal en Excel, synthèse mensuelle en PDF, catégories
  alignées SYSCOHADA. Prêt pour le comptable. »

### 5. Pourquoi local

Titre : « Pensé ici, pas traduit. »
Quatre points sur une seule ligne, séparés par des filets verticaux fins :

- **FCFA** — « Les montants sont des entiers, sans centimes. »
- **Wave** — « Payez votre abonnement depuis votre téléphone. »
- **SYSCOHADA** — « Les vrais numéros de compte : 601, 6053, 622. »
- **Français** — « Toute l'interface, y compris le support. »

### 6. Tarifs

Titre : « Trois plans, en francs CFA. »
Un sélecteur Mensuel / Annuel avec la mention « 2 mois offerts » sur Annuel.
Trois cartes ; celle du milieu (Pro) est mise en avant par un filet indigo et une
petite étiquette « Le plus choisi ».

- **Starter — 12 500 FCFA / mois** : 3 utilisateurs · 150 dépenses par mois ·
  20 scans OCR · budgets et alertes e-mail · exports PDF · support par e-mail
- **Pro — 30 000 FCFA / mois** : 10 utilisateurs · dépenses illimitées ·
  200 scans OCR · alertes SMS · notes de frais · exports Excel et PDF ·
  support e-mail et WhatsApp
- **Business — 60 000 FCFA / mois** : utilisateurs illimités · scans OCR
  illimités · tout Pro · support prioritaire et accompagnement au démarrage

Sous les cartes : « Essai gratuit de 14 jours sur tous les plans. Aucune carte
bancaire demandée. »

### 7. Appel final

Une bande pleine largeur, fond `#12151E`, avec le motif de réglure très
discrètement en fond.
Titre : « Commencez par la dernière dépense que vous avez payée. »
Bouton plein indigo : « Créer mon compte ».

### 8. Pied de page

Trois colonnes : Produit (Fonctionnalités, Tarifs, Connexion) · Entreprise
(À propos, Contact) · Légal (Conditions, Confidentialité).
En bas : « AFRICATECHNOLOGIE / E-DEV — Saint-Louis / Dakar, Sénégal ·
africatechnologie9@gmail.com · +221 76 843 12 63 »

## TON DE LA COPIE

Phrases courtes, verbes actifs, aucun superlatif marketing. On décrit ce que
l'outil fait, on ne le vend pas. Pas de « révolutionnaire », pas de « puissant »,
pas de « solution tout-en-un ». Un gérant de PME de Saint-Louis doit comprendre
chaque phrase du premier coup.
