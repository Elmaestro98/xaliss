# 📋 XAALIS — Document projet

> **Cahier des charges & spécifications techniques**
> Plateforme SaaS de gestion des dépenses pour PME — AFRICATECHNOLOGIE / E-DEV
> Version 1.0 — Juillet 2026

Ce fichier est la **source de vérité** du projet. Toute décision fonctionnelle ou technique doit s'y référer.

---

## 1. Présentation

**Xaalis** (« l'argent » en wolof) est une plateforme SaaS qui permet aux PME sénégalaises de gérer leurs dépenses, budgets, notes de frais et rapports comptables.

**Problème résolu** : la majorité des PME gèrent leurs dépenses sur papier ou Excel → reçus perdus, dépassements de budget non détectés, fraudes difficiles à tracer, bilans laborieux.

**Positionnement** : alternative locale et abordable aux solutions internationales (Expensify, Spendesk) — tarifs en FCFA, abonnement payable par Wave (pas de carte bancaire exigée), interface mobile-first en français, catégories alignées SYSCOHADA.

---

## 2. Objectifs

| Objectif                            | Mesure                                    |
| ----------------------------------- | ----------------------------------------- |
| Visibilité temps réel des dépenses  | Dashboard consulté quotidiennement        |
| Dématérialisation des justificatifs | Photo + OCR, zéro reçu perdu              |
| Contrôle interne                    | Workflow de validation des notes de frais |
| Conformité comptable                | Exports Excel/PDF alignés SYSCOHADA       |
| Anticipation                        | Alertes budget email/SMS à 80 % et 100 %  |
| Rentabilité                         | 50 entreprises actives = coûts couverts   |

---

## 3. Cibles

| Persona          | Profil                                                              | Besoins clés                                                                     |
| ---------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Le Gérant**    | Dirigeant PME 5–50 employés (commerce, BTP, services, restauration) | Vue globale, alertes budget, validation mobile des notes de frais                |
| **Le Comptable** | Comptable interne ou cabinet externe                                | Saisie rapide, catégories SYSCOHADA, exports Excel/PDF                           |
| **L'Employé**    | Commercial, chauffeur, technicien terrain                           | Soumettre une note de frais en photographiant son reçu, suivre son remboursement |

---

## 4. Périmètre fonctionnel V1

### 4.1 Module Dépenses

- Saisie : montant (FCFA), date, catégorie, fournisseur, mode de paiement (espèces, Wave, Orange Money, virement, carte), description
- Justificatifs : photo mobile ou upload (image/PDF) → Supabase Storage (bucket privé, URLs signées)
- **OCR** : extraction automatique montant/date/fournisseur → pré-remplissage du formulaire → validation manuelle
- Catégories personnalisables + référentiel par défaut aligné SYSCOHADA
- Dépenses récurrentes (loyer, abonnements) générées automatiquement
- Recherche, filtres (période, catégorie, employé, statut), pagination

### 4.2 Module Budgets

- Budgets mensuels ou trimestriels, globaux ou par catégorie
- Jauges de consommation temps réel
- Alertes email + SMS à 80 % et 100 % (seuils configurables)

### 4.3 Module Notes de frais

- L'employé regroupe une ou plusieurs dépenses avec justificatifs
- **Workflow** : `BROUILLON → SOUMISE → APPROUVEE | REJETEE → REMBOURSEE`
- Motif de rejet obligatoire, historique complet des actions
- Notification email/SMS à chaque changement de statut
- À l'état REMBOURSEE : les dépenses intègrent le journal de l'entreprise

### 4.4 Module Rapports & Dashboard

- Dashboard : total du mois, évolution vs M-1, top 5 catégories, budgets en alerte, notes en attente
- Graphiques (recharts) : évolution mensuelle, répartition par catégorie / employé / mode de paiement
- Exports : journal des dépenses (Excel), synthèse mensuelle (PDF), état des notes de frais par employé (PDF)

### 4.5 Administration

- Utilisateurs : invitation email, rôles, désactivation
- Paramètres : logo, seuils d'alerte, catégories
- Abonnement : choix du plan (mensuel ou annuel), paiement Wave, factures

### 4.6 Console éditeur — `/editeur`

Pour AFRICATECHNOLOGIE, pas pour les clients. Toutes les entreprises, leur
abonnement, leur échéance, leurs effectifs, et la file des paiements déclarés
en attente de vérification.

**Elle encaisse** (décision du 15 août 2026, qui revient sur le choix
initial — voir §7). Chaque déclaration porte un champ « montant constaté sur
Wave », **jamais prérempli**, et deux boutons : encaisser, rejeter. Le reste de
la console est en lecture seule.

Le champ non prérempli est le cœur du dispositif : prérempli, il ferait de la
confrontation un simple clic, et un clic ne vérifie rien. L'éditeur lit la
somme sur Wave Business et la retape — un écart marque le paiement en échec
**sans** activer l'abonnement.

L'aiguillage `/apres-connexion` envoie l'éditeur ici après connexion, et les
clients vers `/dashboard`. Redirection et non blocage : l'éditeur est aussi
gérant de sa propre entreprise, `/dashboard` lui reste ouvert.

L'accès ne passe pas par un rôle : `Membership.role` dit ce qu'une personne
peut faire **dans** son entreprise, or l'éditeur n'est dans aucune. La liste
vit dans `SUPER_ADMIN_USER_IDS` — une donnée de déploiement, comme
`ADMIN_SECRET`, qu'aucune requête ne peut modifier. Variable absente = 404
pour tout le monde.

### ❌ Hors périmètre V1 (→ V2)

App mobile native, gestion des revenus/trésorerie, multi-devises, multi-succursales, intégrations comptables tierces.

---

## 5. Rôles & permissions

| Fonctionnalité              | ADMIN (Gérant) | COMPTABLE |      EMPLOYE      |
| --------------------------- | :------------: | :-------: | :---------------: |
| Voir toutes les dépenses    |       ✅       |    ✅     |   Ses dépenses    |
| Créer/modifier une dépense  |       ✅       |    ✅     | Via note de frais |
| Supprimer une dépense       |       ✅       |    ✅     |        ❌         |
| Gérer catégories & budgets  |       ✅       |    ✅     |        ❌         |
| Soumettre une note de frais |       ✅       |    ✅     |        ✅         |
| Approuver/rejeter une note  |       ✅       |    ❌     |        ❌         |
| Marquer comme remboursée    |       ✅       |    ✅     |        ❌         |
| Exports comptables          |       ✅       |    ✅     |        ❌         |
| Utilisateurs & abonnement   |       ✅       |    ❌     |        ❌         |
| Dashboard                   |    Complet     |  Complet  |  Vue personnelle  |

⚠️ **Toutes les permissions sont vérifiées côté serveur** (`lib/permissions.ts`), jamais uniquement côté client.

---

## 6. Architecture technique

### Stack

- **Next.js 15+ App Router** — TypeScript (.ts/.tsx)
- **Tailwind CSS** — design mobile-first, PWA installable
- **PostgreSQL Supabase** + **Prisma** — RLS pour l'isolation multi-tenant
- **Clerk Organizations** — auth, rôles, invitations
- **Supabase Storage** — justificatifs (buckets privés)
- **API Gemini (Google)** — OCR vision des reçus (palier gratuit)
- **Resend** — emails transactionnels
- **API Orange SMS** — alertes SMS
- **Wave Business** — paiement des abonnements (checkout + webhook signé)
- **exceljs / pdf-lib** — exports
- **Vercel** — hébergement, CI/CD

### Conventions critiques

```env
# Supabase : POOLER obligatoire en serverless
DATABASE_URL="...pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="...supabase.com:5432/postgres"

# Paiements Wave — lien de paiement du portefeuille marchand, à montant libre.
# Absente : la souscription échoue franchement (il n'y a plus de simulation).
WAVE_PAYMENT_LINK="https://pay.wave.com/m/..."

# Validation manuelle des paiements (/api/admin/paiements + scripts/valider-paiement.ts).
# DISTINCT de CRON_SECRET : un secret déposé chez Vercel pour déclencher des
# tâches n'a pas à ouvrir l'encaissement.
ADMIN_SECRET="..."

# Console éditeur /editeur (lecture seule) — identifiants Clerk séparés par des
# virgules. Absente ou vide : personne n'entre, la page répond 404.
SUPER_ADMIN_USER_IDS="user_xxx,user_yyy"
```

⚠️ **`DATABASE_URL` et `DIRECT_URL` ne sont pas interchangeables.** Ils ont été
trouvés inversés le 15 août 2026 : l'application tapait la connexion directe et
le CLI passait par le pooler. Ça ne se voit pas en développement — seulement en
production, quand les connexions directes s'épuisent et que l'application tombe.

- Middleware Clerk dans **`src/proxy.ts`** (pas `middleware.ts`)
- Chaque requête Prisma filtre par `organizationId` (issu de `auth()` Clerk)
- Montants stockés en **entiers (FCFA sans décimales)**, formatés via `formatFCFA()`
- Interface 100 % en français

### Décisions d'architecture (phase 2)

- **`Organization.id` = identifiant d'organisation Clerk** (`org_xxx`), pas un cuid.
  Évite une table de correspondance et rendra les politiques RLS directes
  (`organization_id = auth.jwt()->>'org_id'`).
- **Les rôles vivent dans notre base** (`Membership.role`), pas dans les rôles
  personnalisés Clerk. Clerk fournit l'identité et l'appartenance ; `lib/permissions.ts`
  fait autorité. Le rôle Clerk ne sert qu'à l'amorçage : créateur → `ADMIN`, invité → `EMPLOYE`.
- **Prisma 7** interdit `url`/`directUrl` dans `schema.prisma` : la connexion passe par
  l'adaptateur `@prisma/adapter-pg` (`lib/prisma.ts`), et le CLI par `prisma.config.ts`.
- **L'instance Clerk force la sélection d'entreprise** (tâche `choose-organization`) :
  toute session sans entreprise reste `pending` et Clerk affiche lui-même l'étape de
  création. Rendue dans Xaalis via la route attrape-tout `/sign-in/[[...sign-in]]`.
  Inutile d'écrire une page d'onboarding maison.
- **Protection des routes dans chaque page** via `requireSession()`, pas par filtrage
  d'URL dans le middleware (`createRouteMatcher` est déprécié côté Clerk).
- **Deux chemins de synchronisation Clerk → base**, une seule définition
  (`lib/sync-clerk.ts`) : le webhook `/api/webhooks/clerk` (temps réel) et la synchro
  à la volée de `getSession()` (filet si un webhook se perd, ou en local sans tunnel).
- **Suppression d'entreprise en deux temps** : le webhook `organization.deleted` pose
  `Organization.deletedAt` — accès coupé immédiatement, données conservées 30 jours —
  puis `/api/cron/purge` (Vercel Cron, `vercel.json`) efface définitivement en cascade.
  Concilie le droit à la suppression (loi 2008-12) et la protection contre la fausse
  manœuvre : un registre comptable ne s'efface pas sur un clic.
- **`requireSession()` distingue trois états**, pas deux : `anonyme` → `/sign-in`,
  `supprimee` → `/entreprise-supprimee`, sinon la session. Confondre les deux premiers
  provoque une **boucle de redirection infinie** — `/sign-in` voit une session Clerk
  active et renvoie aussitôt vers `/dashboard`. La page `/entreprise-supprimee` vit
  donc hors du groupe `(app)`, dont le layout appelle `requireSession()`.

### Décisions d'architecture (phase 7)

- **Un seul abonnement courant par entreprise** (`Subscription.organizationId @unique`).
  Garder un historique dans cette table obligerait chaque lecture à deviner quelle
  ligne fait foi. L'historique, c'est `Payment` — une ligne par tentative, qui sert à
  la fois de trace technique et de facture.
- **Wave est le seul prestataire d'abonnement en V1**, et Xaalis n'appelle pas son
  API : l'entreprise paie sur un **lien de paiement** du portefeuille marchand.
  Orange Money exige un compte marchand validé (KYA) et ne publie pas son contrat
  Sénégal. Reporté en V2.
  **Ne pas confondre avec `PaymentMethod.ORANGE_MONEY`** : celui-là décrit comment une
  PME règle *ses fournisseurs*, reste pleinement pris en charge, et n'a rien à voir
  avec la façon dont elle paie Xaalis (`PaymentProvider`).
- **Un lien de paiement ne transporte aucune référence** — c'est le fait qui gouverne
  tout le reste. Wave ne peut pas dire à Xaalis *quelle* entreprise vient de payer
  *quoi* : il n'y a donc **ni webhook, ni activation automatique**. L'encaissement est
  un geste humain, et l'architecture doit l'assumer plutôt que la maquiller.
- **Trois temps qu'il faut garder distincts** (`lib/facturation.ts`) :
  `lancerPaiement` note ce qui est attendu, `declarerPaiement` enregistre ce que le
  client affirme, `encaisserPaiement` active. Seul le troisième donne accès à quoi que
  ce soit — **un client qui clique n'est pas un client qui a payé**. D'où le statut
  `AWAITING_VERIFICATION` : le confondre avec `SUCCEEDED` offrirait un plan Business à
  qui sait taper une suite de caractères.
- **Bammite (revendeur PayDunya) a été évalué le 16 août 2026, puis écarté.**
  Conservé ici pour ne pas refaire l'enquête. Son API n'expose qu'un endpoint,
  `payin/init.php` : ni webhook, ni vérification d'état, ni identifiant de
  transaction en retour — l'encaissement serait donc resté manuel de toute façon.
  Sa documentation est par ailleurs fausse sur trois points (identifiants dans le
  corps et non en `Authorization: Bearer`, champ `country` obligatoire non
  documenté, `reference_client` en réalité facultatif), et elle exige une
  `private_key` qui ne nous a jamais été fournie. Aucun bac à sable non plus.
  **Si le sujet revient, viser PayDunya en direct** : compte gratuit, documentation
  publique, IPN, vérification d'état et mode test — tout ce qui manque ici.
- **~~L'inaccessibilité remplace la signature.~~ Révisé le 15 août 2026.**
  Le choix initial : aucune requête web ne mène à l'encaissement. L'activation
  ne passait que par `/api/admin/paiements`, protégée par `ADMIN_SECRET` et
  appelée uniquement par `scripts/valider-paiement.ts`. Là où la signature HMAC
  prouvait l'origine d'un webhook, c'était l'inaccessibilité.
  **La console éditeur (§4.6) a levé cette barrière**, à la demande explicite
  de l'éditeur : valider en ligne de commande à chaque souscription n'était pas
  tenable à l'usage.
  Ce qui protège l'encaissement désormais, et qu'il faut tenir :
  1. `requireEditeur()` en **tête de chaque action serveur** — une action
     serveur est une route publique tant qu'elle ne s'est pas gardée elle-même ;
  2. le montant constaté est **retapé** et confronté à l'attendu ;
  3. l'`AuditLog` enregistre **quel** éditeur a validé (`editeur:user_xxx`), ce
     que la ligne de commande ne pouvait pas faire.
  **Risque assumé** : le compte Clerk de l'éditeur devient la clé de
  l'encaissement. S'il est compromis, un attaquant s'active le plan de son
  choix — là où il lui aurait fallu un accès au serveur. À compenser par
  l'authentification à deux facteurs sur ce compte.
- **Une seule implémentation de l'activation.** Deux chemins y mènent
  maintenant — le script par `/api/admin/paiements`, la console par une action
  serveur — mais tous deux appellent `encaisserPaiement()`. Le script reste une
  façade : il n'écrit rien en base. Deux implémentations divergeraient, et
  c'est toujours celle qu'on ne teste pas qui casse.
- **Le montant n'est jamais reçu du client** : il est calculé depuis `lib/plans.ts` à
  la création du paiement, affiché en grand sur l'écran de paiement (le lien Wave est à
  montant libre), et l'éditeur peut le **confronter** à ce qu'il constate au moment de
  valider. Un écart enregistre l'échec sans activer.
- **La référence sert de motif de versement.** C'est le seul fil entre un virement reçu
  sur le portefeuille marchand et l'entreprise qui l'a émis — d'où son alphabet sans
  `I`, `O`, `0` ni `1` : elle se dicte au téléphone.
- **Le quota OCR compte les appels, pas les reçus conservés** (table `OcrUsage`).
  C'est le coût de l'appel à Gemini que le quota protège ; quelqu'un qui scanne sans
  enregistrer le consomme quand même. Le compteur n'est posé qu'**après** un appel
  réussi : une panne de Gemini n'ampute pas le quota du client.
- **Un impayé ferme la saisie, jamais le registre.** Échéance dépassée → `PAST_DUE` et
  7 jours de grâce (accès complet), puis `SUSPENDED` = lecture seule. Les données
  restent consultables et **exportables en PDF** indéfiniment. Même principe que la
  suppression d'entreprise : la comptabilité d'une PME lui appartient, on ne la retient
  pas en otage.
- **Plus de mode simulation.** Il n'a plus d'objet : le parcours ne dépend plus de clés
  d'API, et le seul point d'activation est déjà hors du web. Sans lien configuré, la
  souscription échoue franchement plutôt que de faire semblant.
- **Reporter la limite de sièges sur Clerk relit avant d'écrire.** Mettre à jour
  l'organisation fait émettre à Clerk un `organization.updated`, que notre webhook
  traite en rappelant la même fonction : sans comparaison préalable, les deux se
  relanceraient indéfiniment.

### Décisions d'architecture (phase 3)

- **Une dépense issue d'une note de frais ne se corrige pas depuis le journal.**
  Elle est passée par l'approbation d'un gérant (§8) : la retoucher ensuite
  réécrirait après coup une décision validée. Tant que la note est en
  `BROUILLON`, son auteur la corrige depuis la note ; une fois remboursée, elle
  est figée et le journal n'en propose ni lien de modification ni suppression.
- **La suppression est ouverte au COMPTABLE, pas réservée au gérant.** Sans
  cela, une saisie erronée obligerait à écrire une contre-dépense pour
  l'annuler : un journal faussé par une permission trop étroite. Le garde-fou
  n'est pas le rôle mais la trace — `AuditLog` conserve le contenu intégral de
  la dépense effacée, ce que la ligne supprimée ne fait plus.
- **La modification ne consomme pas de quota**, contrairement à la saisie :
  corriger n'ajoute pas de dépense. Une entreprise au plafond de son plan doit
  pouvoir réparer une faute de frappe — sinon la limite tarifaire empêcherait
  de rendre le journal exact.
- **Une alerte budget se déclenche sur le delta, pas sur le nouveau montant.**
  Passer 10 000 à 12 000 ajoute 2 000 à la jauge. Si la catégorie ou la date
  change, la dépense entre dans une jauge où elle n'était pas comptée : elle y
  pèse alors son montant entier.
- **L'ordre bucket/base est le même qu'à la création, en miroir** : le nouveau
  fichier monte avant l'écriture (un échec l'efface), et l'ancien n'est
  supprimé qu'**après** le commit — l'inverse laisserait une dépense pointant
  vers un fichier disparu si la transaction échouait.

### Direction visuelle — « le cahier, la nuit » (refondue phase 8)

**Le cahier.** Xaalis remplace le registre papier des PME : l'interface en emprunte la
structure, pas son apparence. Positionnement oblige (« alternative locale » à
Expensify/Spendesk), un tableau de bord SaaS gris standard serait un contresens.

**La nuit.** Le thème par défaut est sombre. Ce n'est pas « un dashboard sombre de
plus » : la boutique ferme, la comptabilité reste, et c'est le même cahier réglé vu
sous la lampe. Les deux thèmes existent — le clair reste indispensable, un employé qui
photographie un reçu dehors en plein soleil ne lit pas un écran noir.

- **Palette** (`globals.css`), quatre surfaces et une encre :
  `papier` (le fond), `feuille` (la carte), `pose` (une surface posée sur la carte),
  `reglure` (les filets), `encre` / `encre-pale` (le texte), `indigo` (la marque),
  `vert` / `ocre` / `brique` (sous budget / seuil 80 % / dépassement).
- **Le fond n'est pas gris.** `#0B0D12` est un bleu-noir (teinte ~226°), la couleur de
  l'indigo à pleine profondeur. Le noir neutre `#0A0A0A` est le réglage par défaut de
  tout le monde ; celui-ci est celui de Xaalis.
- **Aucune ombre portée, nulle part.** Une ombre suppose une source de lumière, et un
  cahier n'en a pas. Une feuille se détache par son **ton** (un cran au-dessus du fond)
  et son **filet de 1px**. Accessoirement, une ombre noire sur fond noir ne se voit pas.
- **Règle de couleur** : Wave (cyan) et Orange Money (orange) sont des **données**
  (enum `PaymentMethod`), pas du décor. Le décor reste sobre pour les laisser parler :
  la marque n'est ni cyan ni orange. **Corollaire** : dans une liste, la couleur
  signifie la **catégorie** et rien d'autre — le moyen de paiement s'écrit en toutes
  lettres. Les couleurs Wave/OM ne servent que là où le moyen de paiement est le sujet.
- **Typographie** : **une seule famille**, Archivo variable. Le contraste titre/texte
  vient de son **axe de largeur** (`.titre`, `font-stretch: 118%`), pas d'une seconde
  police — mobile-first au Sénégal signifie ne pas imposer trois familles à un forfait
  data. IBM Plex Mono uniquement pour les codes SYSCOHADA (`.code-compte`) et les
  en-têtes de colonne (`.mention`, les petites capitales du registre).
- **Structure** : les codes SYSCOHADA (601, 6053, 622…) sont de vrais numéros de compte
  et servent de numérotation. Pas de faux marqueurs 01/02/03.
- **Montants** : `.chiffre` (chiffres tabulaires) partout, et `.chiffre-affichage` pour
  **un seul** montant héros par écran — celui qui répond à la question qu'on se pose en
  ouvrant la page. `formatFCFA()` / `formatNombre()` dans `lib/format.ts`.
- **Rayon 0.75rem.** L'ancienne règle (« un registre est équerré », rayon 0.25rem) est
  abandonnée : un coin vif scintille sur fond sombre, et le produit doit rester tenable
  au pouce.

#### La signature : la réglure est aussi la texture

Le même trait sert à deux échelles, et c'est ce qui distingue Xaalis de n'importe quel
autre tableau de bord :

- **Pas 2,75rem — structure** (`.papier-regle`). Les rangées se posent réellement
  dessus : c'est la hauteur de ligne du registre. Jamais de réglure décorative sur un
  écran vide.
- **Pas 0,375rem — texture** (`.regle-texture` en CSS, `MotifReglure` en SVG pour
  recharts). Remplit **ce qui n'est pas le sujet**. Une donnée secondaire n'est pas
  grisée, elle est **réglée** : elle reste du papier, elle n'est simplement pas encore
  écrite. Trois applications, toutes sémantiques :
  - graphe d'évolution : les mois passés sont réglés, le mois courant est à l'encre ;
  - jauges de budget et de quota : le **reste à dépenser** est réglé, pas grisé ;
  - bande de répartition : le reliquat « autres catégories » est réglé, pas coloré.

#### Deux écarts assumés par rapport à la maquette de référence

- **La barre latérale garde ses libellés**, contre l'usage du rail d'icônes seules.
  Xaalis n'est pas un outil qu'on ouvre huit heures par jour : un chauffeur y passe deux
  minutes par semaine et n'aura jamais appris qu'un portefeuille signifie « notes de
  frais ». Une icône seule est un raccourci pour les habitués, payé par les autres.
- **Pas d'étiquette de montant dans les barres du graphe.** En FCFA un mois s'écrit
  « 1 250 000 » : sept caractères qui ne tiennent pas dans une barre de téléphone. Le
  total exact est déjà en grand au-dessus, et chaque mois se lit au toucher.

#### Vocabulaire des statuts

Cinq tons, un sens chacun, partout identiques (`components/pastille-statut.tsx`) :
`neutre` (rien d'engagé) · `indigo` (en cours) · `ocre` (accepté mais pas soldé, ou
seuil d'alerte) · `vert` (soldé, sous budget) · `brique` (refusé, impayé, dépassement).
Le statut s'écrit **toujours en toutes lettres**, la couleur ne fait que le confirmer —
sans quoi il disparaîtrait pour un daltonien et sur un export imprimé en noir et blanc.

⚠️ **Le sens des couleurs est inversé par rapport à un tableau de bord de chiffre
d'affaires.** Ici on compte des **dépenses** : une hausse est un signal rouge, une
baisse est verte. Reprendre le réflexe « hausse = vert » féliciterait le gérant pour un
dérapage budgétaire.

---

## 7. Modèle de données (13 tables)

```prisma
Organization      // Tenant : name, logo, currency, settings, plan
Membership        // userId (Clerk) ↔ organizationId + role (ADMIN|COMPTABLE|EMPLOYE)
Category          // name, codeSyscohada, color, isDefault
Expense           // amount (Int, FCFA), date, categoryId, supplier,
                  // paymentMethod, status, createdById, reportId?
Receipt           // expenseId, fileUrl, ocrData (Json), ocrStatus
RecurringExpense  // template (Json), frequency, nextRunAt
Budget            // categoryId?, amount, period (MONTHLY|QUARTERLY), alertThresholds
ExpenseReport     // employeeId, title, status (workflow), totalAmount, submittedAt
Approval          // reportId, actorId, action, comment, createdAt
Subscription      // plan, status, billingCycle, provider, currentPeriodEnd, graceEndsAt
                  // organizationId @unique : un seul abonnement courant par entreprise
Payment           // reference (= n° de facture ET motif du versement Wave), provider,
                  // plan, amount, status, providerTransactionId (déclaré par le client)
OcrUsage          // organizationId, userId, createdAt — compteur du quota OCR mensuel
AuditLog          // actorId, entity, action, metadata (Json), createdAt
```

**Relations clés** :

- `Expense.reportId` → nullable : une dépense peut exister seule ou dans une note de frais
- `Budget.categoryId` → nullable : budget global si null
- Toutes les tables portent `organizationId` (indexé)

---

## 8. Workflow notes de frais

```
BROUILLON ──soumettre──▶ SOUMISE ──approuver──▶ APPROUVEE ──rembourser──▶ REMBOURSEE
                            │
                            └──rejeter (motif)──▶ REJETEE ──corriger──▶ BROUILLON
```

| Transition          | Acteur autorisé    | Notification          |
| ------------------- | ------------------ | --------------------- |
| Soumettre           | Employé (auteur)   | Gérant (email + SMS)  |
| Approuver / Rejeter | ADMIN uniquement   | Employé (email + SMS) |
| Rembourser          | ADMIN ou COMPTABLE | Employé (email)       |

Chaque transition crée une ligne `Approval` + une ligne `AuditLog`.

---

## 9. Intégrations

### OCR (API Gemini)

1. Upload du reçu → Supabase Storage
2. Route `/api/ocr` : image en base64 → Gemini vision avec schéma de sortie JSON strict
3. Retour : `{ amount, currency, date, supplier, suggestedCategory, confidence }`
4. Pré-remplissage du formulaire, validation humaine obligatoire
5. `ocrData` + `confidence` stockés dans `Receipt` pour audit

### Paiements abonnement

Paiement par **lien Wave à montant libre**, encaissement validé à la main :

1. Le gérant choisit un plan → `Payment` créé en `PENDING`, référence `XAA-2026-…`
2. `/abonnement/paiement/[reference]` dicte le **montant exact** et la **référence à
   mettre en motif**, puis ouvre le lien Wave
3. Il paie dans Wave, revient, recopie l'identifiant de son reçu → `AWAITING_VERIFICATION`
4. L'éditeur retrouve le versement sur Wave Business, puis valide :
   `npx tsx scripts/valider-paiement.ts liste | valider <réf> [montant] | rejeter <réf>`
5. `Subscription.status = ACTIVE`, période prolongée (un renouvellement anticipé
   **ajoute** à l'échéance en cours au lieu de la remplacer)

- Échec de renouvellement → délai de grâce 7 jours → suspension (lecture seule)
- Orange Money : hors périmètre V1 (voir §13)
- ⚠️ Aucune activation automatique : un paiement non validé laisse l'entreprise sur son
  essai ou son plan précédent. Relever les déclarations en attente fait partie de
  l'exploitation quotidienne.

### Notifications

| Événement                         | Email              | SMS                |
| --------------------------------- | ------------------ | ------------------ |
| Note soumise                      | Gérant             | Gérant (optionnel) |
| Note approuvée/rejetée/remboursée | Employé            | Employé            |
| Budget 80 % / 100 %               | Gérant + Comptable | Gérant             |
| Invitation utilisateur            | Invité             | —                  |
| Échec paiement                    | Gérant             | Gérant             |

---

## 10. Sécurité & conformité

- TLS partout, données chiffrées au repos
- **Isolation des entreprises — garde applicative** (`lib/prisma.ts`). Une
  extension Prisma **refuse** toute requête multi-lignes (`findMany`,
  `findFirst`, `count`, `aggregate`, `groupBy`, `updateMany`, `deleteMany`) sur
  une table d'entreprise qui n'est pas filtrée par `organizationId` — et dans un
  `OR`, il faut que **chaque branche** le porte. Un filtre oublié devient une
  erreur immédiate au lieu d'une fuite silencieuse. Les requêtes légitimement
  transverses (crons, purge, console éditeur) passent par `prismaHorsPortee`,
  dont le nom est fait pour être cherché : `grep prismaHorsPortee src/` donne la
  liste exhaustive des endroits qui regardent par-dessus la cloison.
  Vérifiée par `scripts/test-garde-portee.ts` (14 cas).
- ⚠️ **RLS PostgreSQL : écrit, pas activé** (`prisma/migrations-rls/`). Trois
  obstacles, documentés là-bas : l'application se connecte en `postgres`, le
  rôle **propriétaire** des tables, qui ignore ses propres policies ; la règle
  prévue à l'origine (`auth.jwt()->>'org_id'`) est un outil Supabase inopérant
  sur une connexion Prisma directe, sans jeton ; et poser le contexte
  d'entreprise coûte une transaction par requête. La garde applicative couvre
  le risque réel — l'oubli d'un développeur — mais **pas** une injection SQL,
  ni une écriture par identifiant non vérifiée, ni une requête lancée hors de
  l'application. Ne pas promettre du RLS à un client tant que ce dossier n'est
  pas appliqué.
- Buckets Storage privés, URLs signées à durée limitée
- `AuditLog` immuable sur toutes les actions sensibles
- Sauvegardes quotidiennes, rétention 30 jours
- Conformité **loi sénégalaise n° 2008-12** (CDP) : consentement, droit d'accès/suppression
- Rate limiting sur les endpoints sensibles, validation serveur systématique

---

## 11. Plans tarifaires

|                         | STARTER     | PRO              | BUSINESS                 |
| ----------------------- | ----------- | ---------------- | ------------------------ |
| **Tarif mensuel**       | 12 500 FCFA | 30 000 FCFA      | 60 000 FCFA              |
| Utilisateurs            | 3           | 10               | Illimités                |
| Dépenses/mois           | 150         | Illimitées       | Illimitées               |
| Scan OCR                | 20/mois     | 200/mois         | Illimité                 |
| Budgets + alertes email | ✅          | ✅               | ✅                       |
| Alertes SMS             | ❌          | ✅               | ✅                       |
| Notes de frais          | ❌          | ✅               | ✅                       |
| Exports                 | PDF         | Excel + PDF      | Excel + PDF              |
| Support                 | Email       | Email + WhatsApp | Prioritaire + onboarding |

Essai gratuit **14 jours** • Paiement annuel : **2 mois offerts** • Les limites de plan sont vérifiées côté serveur.

**Où vivent ces règles** : le catalogue (tarifs, quotas, fonctionnalités) est dans
`lib/plans.ts`, les compteurs mensuels dans `lib/quotas.ts`. À ne pas confondre avec
`lib/permissions.ts`, qui répond à une autre question : celui-ci dit « ce **rôle** en
a-t-il le droit ? », ceux-là « l'entreprise a-t-elle **payé** pour ça ? ». Les deux
contrôles se cumulent — un ADMIN en plan Starter n'ouvre pas de note de frais, et un
EMPLOYE en plan Business n'approuve toujours rien.

La limite d'**utilisateurs** fait exception : elle est reportée sur Clerk
(`maxAllowedMemberships`), parce que c'est son interface qui émet les invitations.
Vérifiée seulement chez nous, elle ne serait qu'un affichage.

---

## 12. Plan de développement (13 semaines)

> **Point d'arrêt** — dernier travail (15 août 2026) : **isolation des
> entreprises** et **console éditeur**.
> Garde applicative dans `lib/prisma.ts` (§10), RLS écrit mais non appliqué
> (`prisma/migrations-rls/`), console `/editeur` en **lecture seule**.
> Au passage, deux défauts corrigés : `DATABASE_URL` et `DIRECT_URL` étaient
> **inversés** (l'application n'utilisait pas le pooler — panne garantie en
> production dès la montée en charge), et `/editeur` se préconstruisait en
> statique tant que `auth()` n'était pas appelé avant la liste d'autorisation.
>
> Avant cela : **refonte de la direction visuelle**
> (14 août 2026). Passage de « le cahier » clair à « **le cahier, la nuit** » :
> thème sombre par défaut avec bascule clair, jetons refondus, rayon 0,75rem,
> réglure promue en texture sémantique, pastilles de statut, montant héros.
> Voir §6 — la §6 précédente décrivait le cahier clair et justifiait le rayon
> nul, elle a été réécrite. La **landing page** a suivi dans la foulée
> (`src/app/page.tsx`) : sa grille tarifaire est lue dans `lib/plans.ts` et
> n'est jamais recopiée, pour qu'une page publique ne puisse pas annoncer un
> prix que l'application ne pratique pas.
> Avant cela : bascule de l'API Wave Checkout vers un **lien de paiement Wave**,
> migration `20260814090000_paiement_lien_wave` appliquée — l'API, le webhook
> signé et le mode simulation supprimés, l'activation est manuelle.
> Les phases 2, 3, 4, 6 et 7 sont faites. Deux dettes traînent derrière :
> **RLS** (phase 1) et **SMS** (phase 5).
>
> ⚠️ Rien n'est encore déployé, et **toute la phase 7 plus la refonte visuelle
> ne sont pas commitées**. Le dépôt en est à deux commits (`846a8e1 okprojet`),
> qui ne contiennent ni les abonnements ni le nouveau système visuel.

| Phase | Contenu                                                        | Durée   | Statut                                                                                                                                                                                                       |
| ----- | -------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Setup : Next.js, Prisma, Supabase, Clerk Orgs, RLS, Vercel     | 1 sem   | 🟡 Next.js 16 + Prisma 7 + Supabase + Clerk Orgs faits. Isolation assurée par la **garde applicative** (§10), RLS **écrit mais non appliqué** (`prisma/migrations-rls/`) — **reste : activer le RLS (nouveau rôle de base), déploiement Vercel** (`vercel.json` et ses 2 crons sont prêts) |
| 2     | Auth, onboarding entreprise, utilisateurs & rôles              | 1,5 sem | ✅ Connexion, onboarding entreprise, synchro Clerk→base, catégories SYSCOHADA, matrice de permissions, écran d'équipe (changer de rôle, retirer un membre). Les invitations restent déléguées à l'UI Clerk.  |
| 3     | Module Dépenses : CRUD, catégories, justificatifs, récurrences | 2 sem   | ✅ Système visuel + shadcn/ui, coque de l'app, saisie, journal, justificatifs (Storage + URLs signées), récurrences (+ cron), filtres & pagination, modification et suppression d'une dépense (audit complet) |
| 4     | OCR + Budgets & alertes email                                  | 2 sem   | ✅ OCR Gemini (`/api/ocr`), budgets par catégorie ou globaux, jauges, seuils configurables, alertes email Resend                                                                                              |
| 5     | Notes de frais : workflow + notifications email/SMS            | 2 sem   | 🟡 Workflow complet (soumettre, approuver, rejeter avec motif, corriger, rembourser), `Approval` + `AuditLog`, entrée au journal au remboursement, notifications **email** — **reste : les SMS (Orange)**     |
| 6     | Dashboard, rapports, exports Excel/PDF                         | 1,5 sem | ✅ Dashboard (total du mois, évolution vs M-1, top catégories, notes en attente), graphiques recharts, exports journal (Excel), synthèse et notes de frais (PDF)                                              |
| 7     | Abonnements Wave, facturation                                  | 1,5 sem | ✅ Essai 14 jours, plans et quotas vérifiés côté serveur, page Abonnement + factures, paiement par **lien Wave** (déclaration du client puis validation manuelle de l'éditeur), cron d'échéance et suspension en lecture seule. Orange Money et l'API Checkout reportés en V2. |
| 8     | Landing page, tests, audit sécurité, production 🚀             | 1,5 sem | 🟡 Direction visuelle « le cahier, la nuit » appliquée à toute l'application (§6) + **landing page** (héros, constats, 4 modules, ancrage local, grille tarifaire lue dans `lib/plans.ts`, pied de page) — **reste : les tests, l'audit sécurité et la mise en production** |

**Bêta** : 5–10 PME pilotes (Saint-Louis / Dakar) dès la phase 6.

---

## 13. Évolutions V2

- Revenus & trésorerie complète (encaissements, rapprochements)
- App mobile native (React Native/Expo) avec mode hors-ligne
- Multi-succursales avec consolidation
- Rôle « Cabinet comptable » multi-entreprises
- Assistant IA en langage naturel (« Combien en carburant ce trimestre ? »)
- Agrégation bancaire / Wave Business
- **Encaissement automatique par l'API Wave Checkout** (session + webhook signé) :
  supprime la validation manuelle, mais exige des clés marchand Wave
- **Orange Money comme second prestataire d'abonnement** (nécessite un compte
  marchand validé KYA et la doc Orange Sonatel)
- Interface en wolof

---

## 📞 Contact

**AFRICATECHNOLOGIE / E-DEV** — Saint-Louis / Dakar, Sénégal
📧 africatechnologie9@gmail.com • 📱 +221 76 843 12 63
