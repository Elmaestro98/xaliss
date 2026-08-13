# 📋 XAALIS — Document projet

> **Cahier des charges & spécifications techniques**
> Plateforme SaaS de gestion des dépenses pour PME — AFRICATECHNOLOGIE / E-DEV
> Version 1.0 — Juillet 2026

Ce fichier est la **source de vérité** du projet. Toute décision fonctionnelle ou technique doit s'y référer.

---

## 1. Présentation

**Xaalis** (« l'argent » en wolof) est une plateforme SaaS qui permet aux PME sénégalaises de gérer leurs dépenses, budgets, notes de frais et rapports comptables.

**Problème résolu** : la majorité des PME gèrent leurs dépenses sur papier ou Excel → reçus perdus, dépassements de budget non détectés, fraudes difficiles à tracer, bilans laborieux.

**Positionnement** : alternative locale et abordable aux solutions internationales (Expensify, Spendesk) — tarifs en FCFA, paiement Wave/Orange Money, interface mobile-first en français, catégories alignées SYSCOHADA.

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
- Abonnement : choix du plan, paiement Wave/OM/carte, factures

### ❌ Hors périmètre V1 (→ V2)

App mobile native, gestion des revenus/trésorerie, multi-devises, multi-succursales, intégrations comptables tierces.

---

## 5. Rôles & permissions

| Fonctionnalité              | ADMIN (Gérant) | COMPTABLE |      EMPLOYE      |
| --------------------------- | :------------: | :-------: | :---------------: |
| Voir toutes les dépenses    |       ✅       |    ✅     |   Ses dépenses    |
| Créer/modifier une dépense  |       ✅       |    ✅     | Via note de frais |
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
- **Wave Business + Orange Money** — paiement des abonnements (webhooks)
- **exceljs / pdf-lib** — exports
- **Vercel** — hébergement, CI/CD

### Conventions critiques

```env
# Supabase : POOLER obligatoire en serverless
DATABASE_URL="...pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="...supabase.com:5432/postgres"
```

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

### Direction visuelle (phase 3)

**Le cahier.** Xaalis remplace le registre papier des PME : l'interface en emprunte la
structure, pas son apparence. Positionnement oblige (« alternative locale » à
Expensify/Spendesk), un tableau de bord SaaS gris standard serait un contresens.

- **Palette** (`globals.css`) : `papier` (blanc froid de papier réglé), `reglure`
  (le bleu des lignes → bordures), `encre`, `indigo` (marque : teinture indigo),
  `vert` / `ocre` / `brique` (sous budget / seuil 80 % / dépassement).
- **Règle de couleur** : Wave (cyan) et Orange Money (orange) sont des **données**
  (enum `PaymentMethod`), pas du décor. Le décor reste sobre pour les laisser parler :
  la marque n'est ni cyan ni orange. **Corollaire** : dans une liste, la couleur
  signifie la **catégorie** et rien d'autre — le moyen de paiement s'écrit en toutes
  lettres. Les couleurs Wave/OM ne servent que là où le moyen de paiement est le sujet.
- **Typographie** : **une seule famille**, Archivo variable. Le contraste titre/texte
  vient de son **axe de largeur** (`.titre`, `font-stretch: 118%`), pas d'une seconde
  police — mobile-first au Sénégal signifie ne pas imposer trois familles à un forfait
  data. IBM Plex Mono uniquement pour les codes SYSCOHADA (`.code-compte`).
- **Structure** : les codes SYSCOHADA (601, 6053, 622…) sont de vrais numéros de compte
  et servent de numérotation. Pas de faux marqueurs 01/02/03.
- **La réglure** (`.papier-regle`) n'est utilisée que là où des rangées se posent
  réellement dessus (listes, légendes) — pas de réglure décorative sur un écran vide.
- **Montants** : `.chiffre` (chiffres tabulaires) + `formatFCFA()` (`lib/format.ts`).

---

## 7. Modèle de données (11 tables)

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
Subscription      // plan, status, provider (WAVE|ORANGE_MONEY|STRIPE), currentPeriodEnd
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

- Checkout Wave Business / Orange Money → webhooks `/api/webhooks/wave` et `/api/webhooks/orange-money`
- Webhook confirme → `Subscription.status = ACTIVE`, période mise à jour
- Échec de renouvellement → délai de grâce 7 jours → suspension (lecture seule)

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
- **RLS PostgreSQL** : isolation stricte des tenants
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

Essai gratuit **14 jours** • Paiement annuel : **2 mois offerts** • Les limites de plan sont vérifiées côté serveur (`lib/permissions.ts`).

---

## 12. Plan de développement (13 semaines)

| Phase | Contenu                                                        | Durée   | Statut                                                                                                                                                                                                    |
| ----- | -------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Setup : Next.js, Prisma, Supabase, Clerk Orgs, RLS, Vercel     | 1 sem   | 🟡 Next.js + Prisma + Supabase (11 tables migrées) + Clerk Orgs faits — **reste : RLS, Vercel**                                                                                                           |
| 2     | Auth, onboarding entreprise, utilisateurs & rôles              | 1,5 sem | 🟡 Connexion, onboarding entreprise, synchro Clerk→base, catégories SYSCOHADA, matrice de permissions faits — **reste : invitations + écran de gestion des rôles**                                        |
| 3     | Module Dépenses : CRUD, catégories, justificatifs, récurrences | 2 sem   | 🟡 Système visuel + shadcn/ui, coque de l'app (navigation filtrée par rôle), saisie + journal des dépenses faits — **reste : modification/suppression, justificatifs, récurrences, filtres & pagination** |
| 4     | OCR + Budgets & alertes email                                  | 2 sem   | ⬜                                                                                                                                                                                                        |
| 5     | Notes de frais : workflow + notifications email/SMS            | 2 sem   | ⬜                                                                                                                                                                                                        |
| 6     | Dashboard, rapports, exports Excel/PDF                         | 1,5 sem | ⬜                                                                                                                                                                                                        |
| 7     | Abonnements Wave/OM, webhooks, facturation                     | 1,5 sem | ⬜                                                                                                                                                                                                        |
| 8     | Landing page, tests, audit sécurité, production 🚀             | 1,5 sem | ⬜                                                                                                                                                                                                        |

**Bêta** : 5–10 PME pilotes (Saint-Louis / Dakar) dès la phase 6.

---

## 13. Évolutions V2

- Revenus & trésorerie complète (encaissements, rapprochements)
- App mobile native (React Native/Expo) avec mode hors-ligne
- Multi-succursales avec consolidation
- Rôle « Cabinet comptable » multi-entreprises
- Assistant IA en langage naturel (« Combien en carburant ce trimestre ? »)
- Agrégation bancaire / Wave Business
- Interface en wolof

---

## 📞 Contact

**AFRICATECHNOLOGIE / E-DEV** — Saint-Louis / Dakar, Sénégal
📧 africatechnologie9@gmail.com • 📱 +221 76 843 12 63
