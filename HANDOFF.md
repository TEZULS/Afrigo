# AfriGo — Documentation 

## 1. Vue d'ensemble

AfriGo est une application mobile (iOS + Android) de commerce et de livraison dédiée au marché africain. L'application est construite avec **React Native / Expo** et s'appuie sur un backend **base44** (fonctions serverless Deno) pour la logique métier (paiements, fidélité, e-mails, gestion des stocks, etc.).

Elle propose trois interfaces distinctes selon le rôle de l'utilisateur :

- **Client** : navigation produits, panier, checkout (Stripe), suivi de commande, retours, programme de fidélité, parrainage, messagerie, profil.
- **Admin** : tableau de bord, gestion des commandes, produits, utilisateurs, messages (certains écrans complexes sont délégués à une WebView vers la version web).
- **Livreur** : connexion dédiée, tableau de bord des livraisons assignées, détail et mise à jour du statut des commandes.

Un dépôt monorepo accompagne ce projet : il contient également l'application **web** (Vite + React) sous `src/` et les fonctions cloud **base44** sous `base44/`. La documentation ci-dessous se concentre sur la partie **mobile** (`mob/`), qui est le périmètre de la remise.

---

## 2. Stack technique

| Couche            | Technologie                              | Version       |
|-------------------|------------------------------------------|---------------|
| Framework mobile  | Expo SDK                                 | ~55.0.0       |
| Runtime           | React Native                             | 0.83.6        |
| UI Library        | React                                    | 19.2.0        |
| Langage           | TypeScript                               | ^5.6.3        |
| Navigation        | React Navigation (native-stack, tabs, drawer) | ^7.0.0   |
| State global      | Zustand                                  | ^5.0.2        |
| Data fetching     | TanStack React Query                     | ^5.84.1       |
| Styling           | StyleSheet + tokens (`theme/`) — NativeWind retiré | -             |
| Paiements         | @stripe/stripe-react-native              | 0.63.0        |
| Backend SDK       | @base44/sdk                              | ^0.8.27       |
| Stockage sécurisé | expo-secure-store                        | ~55.0.14      |
| Stockage local    | @react-native-async-storage/async-storage | 2.2.0        |
| OTA updates       | expo-updates                             | ~55.0.23      |
| Animations        | react-native-reanimated + react-native-worklets | 4.2.1 / 0.7.4 |
| Icônes            | lucide-react-native                      | ^0.468.0      |
| Tests             | Jest + jest-expo                         | ~55.0.18      |
| Build / CI        | EAS Build (Expo Application Services)    | CLI >= 10.0.0 |
| Submit            | EAS Submit (iOS App Store + Play Store)  | -             |
| Backend           | base44 (fonctions Deno serverless)       | SDK 0.8.27    |

---

## 3. Structure du dépôt

```
afri-go/
├── src/                          # Application web (Vite + React) — hors périmètre de cette doc
├── public/                       # Assets web
├── base44/                       # Backend base44
│   ├── entities/                 # Définitions d'entités (Product, User, AppSettings, ...)
│   └── functions/                # 21 fonctions cloud Deno (paiements, fidélité, notifications, ...)
├── mob/                          # ← Application mobile (périmètre de la remise)
│   ├── App.tsx                   # Composant racine (providers : Auth, Theme, Query, Stripe)
│   ├── index.ts                  # Entry point Expo
│   ├── app.json                  # Config Expo (bundle IDs, version, plugins)
│   ├── eas.json                  # Config EAS Build / Submit
│   ├── package.json              # Dépendances et scripts npm
│   ├── tsconfig.json             # Config TypeScript stricte
│   ├── .env.example              # Modèle des variables d'environnement
│   ├── .npmrc                    # legacy-peer-deps=true (NE PAS TOUCHER)
│   ├── assets/                   # Logo, fonts, splash, icônes
│   ├── scripts/                  # Scripts Node (Windows JDK, gradle bundle, clean...)
│   └── src/
│       ├── api/                  # Adapter @base44/sdk + entities/functions
│       ├── components/           # Composants UI (ui, products, cart, orders, profile, menu...)
│       ├── config/               # env.ts (lecture des EXPO_PUBLIC_*)
│       ├── hooks/                # useAppSettings, useToast
│       ├── lib/                  # AuthContext, query-client, cartRemote
│       ├── navigation/           # RootNavigator, ClientTabs, AdminDrawer, DelivererStack
│       ├── screens/              # 33 écrans (auth, client, admin, deliverer)
│       ├── services/             # storage (secure + AsyncStorage), cartServerSync
│       ├── stores/               # Zustand : cart, menuDrawer
│       ├── theme/                # ThemeProvider, tokens (couleurs, spacing, typo)
│       ├── types/                # Types TypeScript partagés
│       └── utils/                # cn, format, routes, productShopMode
└── package.json                  # Workspace racine (web app)
```

---

## 4. Identifiants de l'application

Valeurs extraites de `mob/app.json` et `mob/eas.json` au moment de la remise.

| Champ                                | Valeur                                       |
|--------------------------------------|----------------------------------------------|
| Nom affiché                          | `AfriGo`                                     |
| Slug Expo                            | `afrigo`                                     |
| URL scheme                           | `afrigo`                                     |
| Version                              | `1.0.27`                                     |
| Bundle ID iOS                        | `app.afrigo.mobile`                          |
| Build number iOS                     | `40` (auto-incrémenté sur `production`)      |
| Package Android                      | `app.afrigo.mobile`                          |
| versionCode Android                  | `25` (auto-incrémenté sur `production`)      |
| Merchant ID (Apple Pay)              | `merchant.app.afrigo.mobile`                 |
| Associated Domain                    | `applinks:afrigo.app`                        |
| EAS Project ID                       | `501b64d7-fd58-449d-8a1e-046a2d43e7d1`       |
| EAS Owner                            | `tezuls`                                     |
| OTA Updates URL                      | `https://u.expo.dev/501b64d7-fd58-449d-8a1e-046a2d43e7d1` |
| Apple ID (compte de soumission)      | `afrigo13kane@gmail.com`                     |
| Apple Team ID                        | `L2XBYAZYUL`                                 |
| ASC App ID (App Store Connect)       | `6771119661`                                 |
| iOS deployment target                | `15.1`                                       |
| Android minSdkVersion / target / compile | `24` / `35` / `35`                       |
| Node version (build EAS)             | `20.18.0`                                    |

---

## 5. Prérequis (machine Windows)

- **Node.js 20.x** (recommandé : `20.18.0` pour matcher l'environnement de build EAS) + **npm**
- **Git** pour Windows
- Un **compte Expo** ayant accès à l'organisation `tezuls` (ou la nouvelle organisation qui sera créée pour le client)
- Un **compte Apple Developer** (pour publier sur l'App Store et utiliser Apple Pay)
- Un **compte Google Play Console** (pour publier sur le Play Store)
- **VS Code** recommandé (extensions : ESLint, Prettier, Tailwind CSS IntelliSense)

Optionnel (uniquement pour builder Android en local sans EAS) :
- **JDK 17** (Temurin)
- **Android Studio** + **Android SDK 35** + un émulateur configuré

> Pour iOS, aucun environnement local n'est nécessaire sur Windows : les builds passent obligatoirement par EAS Build (serveurs macOS d'Expo).

---

## 6. Installation

```bash
git clone <url-du-repo>
cd afri-go/mob
npm install
```

> Le fichier `mob/.npmrc` force `legacy-peer-deps=true`. C'est **indispensable** pour résoudre les peer dependencies du SDK Expo 55 et de Reanimated 4. **Ne pas supprimer ce fichier.**

Ensuite, créer le fichier d'environnement local :

```bash
cp .env.example .env
```

Remplir les valeurs (voir section 9). Les valeurs sensibles (clé API base44, clé publique Stripe de production) sont à demander à l'équipe en place lors de la remise.

---

## 7. Lancer l'app en développement

Depuis `mob/` :

| Cible         | Commande                       | Notes                                                                              |
|---------------|--------------------------------|------------------------------------------------------------------------------------|
| Metro bundler | `npm start`                    | Démarre Expo en mode `--dev-client`                                                |
| Emulateur     | `npm run start:emu`            | Wrapper qui lance Expo en pointant l'IP de l'émulateur                             |
| Android       | `npm run android`              | Build natif + install sur device/émulateur connecté                                |
| Android (Win) | `npm run android:winjdk`       | À utiliser si Gradle ne trouve pas le JDK — force le JDK via `scripts/run-android-with-jdk.cjs` |
| Web           | `npm run web`                  | Mode preview web (limité, certaines libs natives ne fonctionnent pas)              |
| iOS           | `npm run ios`                  | **Indisponible sur Windows** — nécessite un macOS                                  |

### Pour iOS depuis Windows

Il n'est **pas possible** de lancer l'app iOS en local depuis Windows. La procédure est :

1. Enregistrer le device iOS de test : `eas device:create`
2. Lancer un build EAS avec le profil `development` ou `preview` :
   ```bash
   eas build -p ios --profile preview
   ```
3. Installer l'IPA généré sur l'iPhone enregistré (lien fourni par EAS).

---

## 8. Build & publication

### 8.1 iOS depuis Windows

EAS Build compile sur les serveurs macOS d'Expo. Les commandes suivantes se lancent depuis `mob/`.

| Commande                       | Profil       | Sortie                            |
|--------------------------------|--------------|-----------------------------------|
| `npm run build:ios:preview`    | `preview`    | IPA distribué en interne (ad-hoc / TestFlight)  |
| `npm run build:ios:prod`       | `production` | IPA prêt pour l'App Store (auto-incrémente `buildNumber`) |
| `npm run submit:ios`           | -            | Upload du dernier build prod vers App Store Connect |

**Prérequis Apple côté `developer.apple.com` :**

- App ID `app.afrigo.mobile` enregistré avec les capabilities :
  - Associated Domains (pour `applinks:afrigo.app`)
  - Apple Pay (Merchant ID `merchant.app.afrigo.mobile`)
  - Push Notifications
- Merchant ID `merchant.app.afrigo.mobile` enregistré et associé à l'App ID
- App créée dans **App Store Connect** avec :
  - Apple ID (compte) : `afrigo13kane@gmail.com`
  - ASC App ID : `6771119661`
  - Apple Team ID : `L2XBYAZYUL`

### 8.2 Android

| Commande                          | Profil       | Sortie                                  |
|-----------------------------------|--------------|-----------------------------------------|
| `npm run build:android:preview`   | `preview`    | APK pour tests internes (installable manuellement) |
| `npm run build:android:prod`      | `production` | AAB (Android App Bundle) pour Play Store |
| `npm run submit:android`          | -            | Upload du dernier AAB sur la piste `internal` du Play Store |

**Prérequis pour le submit Android :** le fichier `mob/secrets/play-service-account.json` (compte de service Google Play avec rôle "Release manager") doit exister localement. Il n'est pas versionné dans Git. Il est à demander à l'équipe sortante.

### 8.3 Bump de version

1. Éditer `version` dans `mob/app.json` (ex. `1.0.9` → `1.0.10`).
2. Sur le profil `production` (`eas.json`), `autoIncrement: true` est activé :
   - `buildNumber` iOS s'incrémente automatiquement à chaque build EAS
   - `versionCode` Android s'incrémente automatiquement à chaque build EAS
3. Les builds `preview` / `development` n'auto-incrémentent **pas** : le numéro reste celui de `app.json`.

### 8.4 Mises à jour OTA (sans rebuild natif)

Pour pousser un correctif JavaScript/asset sans repasser par les stores :

```bash
eas update --branch production --message "Fix: <description>"
```

Le canal (`channel`) défini par profil dans `eas.json` (`development`, `preview`, `production`) détermine quels devices recevront la mise à jour. La `runtimeVersion` est liée à `appVersion`, donc une mise à jour OTA n'est compatible qu'avec une app installée sous la **même version `1.0.9`**.

---

## 9. Variables d'environnement

Toutes les variables exposées au runtime sont préfixées `EXPO_PUBLIC_` (sinon Expo ne les injecte pas dans le bundle JS).

| Variable                                  | Description                                                                 |
|-------------------------------------------|-----------------------------------------------------------------------------|
| `EXPO_PUBLIC_BASE44_APP_ID`               | ID de l'application base44 (actuel : `6947869a3a13c81a6fad2204`)            |
| `EXPO_PUBLIC_BASE44_API_KEY`              | Clé API base44 utilisée par le SDK (à demander à l'équipe sortante)         |
| `EXPO_PUBLIC_BASE44_SERVER_URL`           | URL du serveur base44 (optionnel, défaut SDK si non fourni)                 |
| `EXPO_PUBLIC_BASE44_FUNCTIONS_VERSION`    | Version des cloud functions à appeler (optionnel)                           |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`      | Clé **publique** Stripe (`pk_test_...` ou `pk_live_...`) — jamais la secrète |
| `EXPO_PUBLIC_APP_BASE_URL`                | URL publique de l'app web (actuel : `https://afrigo.app`) — utilisée pour les deep links et WebView admin |
| `EXPO_PUBLIC_ENV`                         | `development` / `staging` / `production` — utilisé pour affichage de bannières et conditionnement de logs |

> Côté EAS, `EXPO_PUBLIC_BASE44_APP_ID` est aussi injecté via la section `env` du profil `base` dans `eas.json`. Si vous tournez la clé base44, il faudra mettre à jour les deux endroits (le `.env` local **et** `eas.json`), ou basculer sur des secrets EAS (`eas secret:create`).

---

## 10. Backend base44

Le backend AfriGo est hébergé sur la plateforme **base44** et expose 21 fonctions cloud Deno. Elles sont versionnées dans ce dépôt sous `base44/functions/` mais sont déployées séparément via l'interface base44.

### 10.1 Liste des fonctions

| Fonction                            | Rôle                                                                                   |
|-------------------------------------|----------------------------------------------------------------------------------------|
| `handleCustomAuth`                  | Auth multi-actions : vérification email/tél., login, création de compte, reset mot de passe, suppression de compte avec cascade |
| `createPaymentIntent`               | Crée un PaymentIntent Stripe pour le checkout (gère client Stripe, cartes enregistrées) |
| `webhookStripe`                     | Réception des webhooks Stripe : succès, échec, remboursement → met à jour les commandes |
| `processCardRefund`                 | (Admin) Lance un remboursement Stripe et met à jour le statut de la commande           |
| `saveCard`                          | Enregistre la carte Stripe par défaut d'un client (last4, brand, expiry)                |
| `deleteCard`                        | Supprime la carte enregistrée d'un utilisateur (Stripe + profil)                       |
| `testStripeConnection`              | (Admin) Test de connectivité Stripe (récupère le solde du compte)                      |
| `addLoyaltyPointsOnDelivery`        | Crédite les points fidélité quand la commande passe à `delivered` (1 € = 1 point)      |
| `removeLoyaltyPointsOnReturn`       | Décrédite les points fidélité quand un retour est approuvé                             |
| `removeLoyaltyPointsOnCancellation` | Décrédite les points fidélité en cas d'annulation de commande                          |
| `calculateLoyaltyPoints`            | Calcule les points disponibles pour l'utilisateur authentifié                          |
| `resetExpiredPoints`                | Remet à zéro les points des utilisateurs inactifs hors période de validité             |
| `updateStockAfterOrder`             | Déduit le stock après confirmation d'une commande (gère les conversions g/kg/ml/L)     |
| `restoreStockAfterCancellation`     | Restaure le stock après annulation                                                     |
| `notifyAdminsNewOrder`              | Envoie un e-mail à tous les admins lors d'une nouvelle commande                        |
| `sendOrderNotification`             | E-mail au client lors d'un changement de statut de commande                            |
| `sendOrderStatusEmail`              | Envoi d'e-mails de statut avec templates `NotificationTemplate` et substitution        |
| `sendNotDeliveredNotification`      | E-mail au client en cas d'échec de livraison (avec raison, montant, adresse)           |
| `sendCustomInvitation`              | (Admin) Invite un nouvel utilisateur (admin ou client) par e-mail                      |
| `archiveDailyCash`                  | Archive les `CashCollection` du jour                                                   |
| `archiveMonthlyRevenue`             | Archive les statistiques de revenus quotidiens / hebdo / mensuels                      |
| `pushAppNotification`               | (Admin, facultatif) Crée si besoin une `AppNotification` et la fait pousser tout de suite par `dispatchPushNotifications`. Ne pas la nommer `sendPushNotification` : nom réservé par base44 (intégration intégrée). |
| `dispatchPushNotifications`         | (Planifiée, seul expéditeur) Pousse toute `AppNotification` récente non encore envoyée : Apple direct (APNs) ou Expo |

### 10.1 bis Notifications client (in-app + push)

Les notifications destinées aux clients vivent dans **deux entités base44 qui
existent déjà** :

| Entité | Rôle |
|--------|------|
| `AppNotification` | La notification elle-même. Alimentée par l'admin (`type: 'manual'`), le suivi de livraison (`delivery_status`) et les relances panier (`cart_reminder`). Cible `target_audience: 'all'` ou une liste `target_emails`. |
| `NotificationRead` | État par utilisateur et par notification : `is_read`, `read_date`, `deleted`. RLS déjà limitée à `user.email`. |

**Côté mobile** (`mob/src/hooks/useNotificationsFeed.ts`), le fil 🔔 fusionne :

1. `AppNotification.filter({ target_emails: <email> })` — le filtre se comporte
   en « contient » sur le tableau ;
2. `AppNotification.filter({ target_audience: 'all' })` — les diffusions ;
3. l'avancement des commandes et les réponses du service client, pour
   l'historique antérieur à `AppNotification`. Une commande déjà couverte par une
   notification `delivery_status` n'est pas re-dérivée (pas de doublon).

L'état « lu » est écrit dans `NotificationRead`, donc il suit le compte d'un
appareil à l'autre ; un cache local (`kv`) le double pour un affichage instantané
et hors ligne. Ouvrir l'onglet 🔔 remet la bulle à zéro sans tout marquer comme
lu. La suppression par le client écrit `NotificationRead.deleted = true` (comme
le web) : la ligne `AppNotification`, partagée, n'est jamais effacée.

Écran Notifications (2026-10-20) :

- **suppression multiple** : icône « cocher » en haut (ou appui long sur une
  notification) → cases à cocher, « Tout sélectionner », « Supprimer (n) » ;
  les notifications supprimées disparaissent aussi du centre de notifications
  du téléphone ;
- **dates** : « À l'instant », « Il y a 5 min », « Aujourd'hui à 17h05 »,
  « Hier à 17h05 », « Lundi à 9h30 », « 12 oct. à 9h30 »
  (`notificationDateLabel` dans `notificationPresentation.ts`) ;
- les suppressions sont relues à part (`deleted: true`, 1 000 dernières) : une
  notification supprimée ne revient jamais, même au-delà des 500 lignes
  récentes ;
- **rappels de panier** : un seul affiché par sorte (« panier oublié »,
  « bientôt en rupture »), le plus récent. Côté serveur,
  `sendCartReminderNotifications` n'en crée plus qu'un par panier abandonné
  (avant : un toutes les 4 h tant que le panier restait plein, ce qui faisait
  « revenir » les notifications supprimées). Déploiement :
  `node deploy-push-base44/fix-reminders.cjs`.

**Mode par défaut : aucune action sur base44 (2026-10-10).** L'app affiche
elle-même une vraie notification système pour chaque nouveauté du fil
(`AppNotification` créée par l'admin ou automatiquement, nouveau statut de
commande ou de retour, réponse du service client) :

- app ouverte : le fil est relu toutes les 30 s, et aussitôt au retour dans
  l'app ; chaque nouveauté produit une bannière (`alertNewNotifications` dans
  `useNotificationsFeed.ts`, une seule vérification par chargement même si
  plusieurs écrans lisent le fil) ;
- app en arrière-plan ou fermée : `mob/src/services/backgroundNotifications.ts`
  (`expo-background-fetch` + `expo-task-manager`) — le téléphone réveille
  l'app, qui relit le fil et affiche les notifications. Inscrite à la
  connexion, retirée à la déconnexion ;
- jamais deux fois la même (mémoire `notifications_alerted_ids`, appels en
  file) ; au premier passage sur un appareil l'existant est mémorisé sans
  alerte ; rien pour ce qui est déjà lu ailleurs, ni pour la commande que le
  client vient de passer ; une salve est résumée.

Limites (Apple / Google) : le rythme est décidé par le système — au mieux
toutes les 15 min, souvent moins sur iPhone ; sur iPhone rien ne tourne après
une fermeture forcée (app balayée vers le haut) ou si « Actualisation en
arrière-plan » est coupée (Paramètres → Notifications le signale). Ne pas
ajouter `BGTaskSchedulerPermittedIdentifiers` à l'Info.plist (ex.
`expo-background-task`) : iOS couperait alors cette actualisation.

Pour des push **instantanées** app fermée, il faut un envoi serveur : c'est la
chaîne ci-dessous, prête mais facultative (les deux voies ne font pas doublon
grâce à `push_sent`).

**Chaîne push serveur (facultative)**, revue le 2026-10-10 :

1. `mob/src/services/pushNotifications.ts` demande la permission (après la
   connexion), lit le jeton natif de l'appareil (`devicePushToken.ts`), en
   déduit le jeton Expo, et écrit sur le profil `expo_push_token`,
   `apns_device_token` (iPhone), `push_platform`, `push_token_updated_at`,
   `push_enabled`. Le cache local n'est posé que si base44 renvoie bien les
   jetons (sinon nouvel essai au démarrage suivant) ; renvoi au retour dans
   l'app (≤ 1 fois / 10 min), au changement de jeton, et au moins une fois par
   jour. La déconnexion retire les jetons **avant** de couper la session.
2. `dispatchPushNotifications` (**le seul expéditeur**) pousse toute
   `AppNotification` récente non encore envoyée, quelle que soit son origine —
   le formulaire admin ne fait que créer la ligne. Déclenchée par deux
   **Workflows** base44 (`base44/workflows/`) : « Push – envoi immédiat » (à
   chaque création d'`AppNotification`) et « Push – nouvel essai » (toutes les
   15 min, `{"mode": "retry"}`). L'app est en mode Workflows : base44 refuse
   les automatisations attachées aux fonctions (erreur 409 `workflows_enabled`). Ciblage identique
   au fil : diffusion seulement si `target_audience === 'all'`, sinon
   `target_emails`. Un appareil = un jeton = le compte inscrit en dernier.
   - **Apple direct (APNs)** pour les iPhone si les secrets `APNS_KEY_P8`,
     `APNS_KEY_ID`, `APNS_TEAM_ID` sont définis ; **Expo** sinon (et pour
     Android). Jetons morts (410 Apple, `DeviceNotRegistered` Expo) effacés.
   - Réservation `push_sent: true` **avant** l'envoi ; libérée si rien n'est
     parti (3 essais au plus). Sans le champ `push_sent`, la fonction refuse
     d'envoyer (aucun doublon possible).
   - Appel sans le secret `PUSH_DISPATCH_SECRET` (en-tête `x-dispatch-secret`
     ou `cronSecret` dans le corps) ni session admin : fenêtre et volume par
     défaut, aucune statistique renvoyée.
3. `pushAppNotification` (admin, facultatif) crée la notification si besoin
   puis appelle le distributeur pour un envoi immédiat (`force: true` pour
   renvoyer une notification déjà poussée).
4. Un appui ouvre l'écran lié (`related_type` / `related_id`), y compris app
   fermée (la navigation attend que l'app soit prête) ; le retour automatique
   à l'accueil après 5 min d'absence ne l'écrase pas.

**Prérequis de la chaîne serveur (seulement pour des push instantanées) :**

| Étape | Où | Détail |
|-------|----|--------|
| Champs `User` : `expo_push_token`, `apns_device_token` (texte), `push_platform`, `push_token_updated_at` (texte), `push_enabled` (booléen) | base44 → Data → User | **Indispensables.** base44 ignore sans erreur un champ absent du schéma. Liste dans `base44/entities/User.jsonc`. Contrôle sur le téléphone : Paramètres → Notifications → « Reliées à votre compte ». |
| Champ `AppNotification.push_sent` (booléen, défaut `false`) ; facultatifs `push_error` (texte), `push_attempts` (nombre) | base44 → Data → AppNotification | Sans `push_sent`, le distributeur refuse d'envoyer. Cf. `base44/entities/AppNotification.jsonc`. |
| Secret `PUSH_DISPATCH_SECRET` (32+ caractères aléatoires) | base44 → Settings → Secrets | Pour les appels de confiance (dryRun, statistiques). |
| Déployer `dispatchPushNotifications` et ses deux Workflows | `node deploy-push-base44/deploy.cjs` puis `node deploy-push-base44/finish.cjs` (CLI base44 connecté : `npx base44 login`) | Sans les Workflows, aucune push ne part : l'admin ne fait que créer la ligne. Fait le 2026-10-11 : champs User / AppNotification ajoutés, `pushAppNotification` déployée. |
| Déployer `pushAppNotification` | base44 → Code → Functions | Facultatif (envoi immédiat par un admin). |
| iPhone, voie Apple : clé APNs `.p8` → secrets `APNS_KEY_P8` (contenu du fichier), `APNS_KEY_ID`, `APNS_TEAM_ID` = `L2XBYAZYUL` | developer.apple.com → Keys (+) → *Apple Push Notifications service* ; base44 → Secrets | Le fichier ne se télécharge qu'une fois. `APNS_ENV=development` seulement pour un build de dev. |
| iPhone, voie Expo (si pas de clé côté base44) | `cd mob && eas credentials -p ios` → production → Push Notifications | Une clé APNs doit être attachée à `app.afrigo.mobile`, sinon accusé `InvalidCredentials`. Si « Enhanced push security » est activée sur expo.dev, ajouter le secret `EXPO_ACCESS_TOKEN`. |
| Android | Firebase → app `app.afrigo.mobile` → `google-services.json` dans `mob/` ; `eas credentials -p android` → FCM V1 | Sans ce fichier, Android n'obtient **aucun** jeton. `app.config.js` le prend automatiquement s'il existe. **Pas encore fait au 2026-10-20** (0 appareil Android inscrit) : sur Android, seules les notifications produites par l'app elle-même arrivent (app ouverte, ou réveil système en arrière-plan, au mieux toutes les 15 min). |

> Les push ne fonctionnent que sur un **build EAS** installé sur un **appareil
> réel** — ni Expo Go, ni simulateur. Un client sans jeton (jamais connecté
> depuis l'app, notifications refusées) voit quand même la notification dans
> l'onglet 🔔.

**Test direct par Apple** (console Push : icloud.developer.apple.com →
Push Notifications, connecté avec le compte **Account Holder / Admin**) :
sur l'iPhone, Paramètres → Notifications → « Copier le jeton de l'appareil » ;
dans la console : équipe `L2XBYAZYUL`, bundle `app.afrigo.mobile`,
environnement **Production** (TestFlight / App Store), type `alert`, priorité
10, charge utile :

```json
{"aps":{"alert":{"title":"AfriGo","body":"Test direct Apple"},"sound":"default"},"body":{"relatedType":"order","relatedId":"<id de commande>"}}
```

Les données de navigation vont sous la clé `body` (lue par expo-notifications).
`BadDeviceToken` = mauvais environnement ou jeton Expo collé à la place du
jeton Apple. Si ce test arrive mais pas les push base44, le problème est côté
serveur (déploiement, planification, clé).

**État constaté le 2026-10-10** (sondes publiques) : `dispatchPushNotifications`
et `pushAppNotification` ne sont **pas déployées** (« not found or not
deployed ») ; le formulaire admin publié ne fait que `AppNotification.create`.
Tant que le tableau ci-dessus n'est pas fait, **aucune push n'est envoyée**.

Vérification après déploiement :

```bash
curl -X POST "https://base44.app/api/apps/<APP_ID>/functions/dispatchPushNotifications" \
  -H "Content-Type: application/json" -H "x-dispatch-secret: <PUSH_DISPATCH_SECRET>" \
  -d '{"dryRun": true, "sinceMinutes": 1440}'
# → {"success":true,"dryRun":true,"channel":"apple+expo","notifications":N,"devices":M}
#   devices = 0 : aucun profil ne porte encore de jeton (champs User absents, ou
#   personne ne s'est reconnecté depuis la 1.0.34).
```

### 10.2 Variables d'env. côté backend

Ces variables sont configurées dans l'interface base44 (pas dans le repo) :

- `STRIPE_SECRET_KEY` — clé secrète Stripe (jamais exposée au mobile)
- `STRIPE_API_KEY` — alias / variante selon les fonctions
- `STRIPE_WEBHOOK_SECRET` — signature des webhooks Stripe
- `PUSH_DISPATCH_SECRET` — appels de confiance à `dispatchPushNotifications` (tâche planifiée)
- `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID` (+ `APNS_ENV` facultatif) — envoi direct par Apple
- `EXPO_ACCESS_TOKEN` — facultatif, si « Enhanced push security » est activée sur expo.dev
- `PUSH_TYPES` — facultatif, types d'`AppNotification` à pousser (ex. `manual,delivery_status`)

### 10.3 Appeler une fonction depuis le mobile

Via le SDK `@base44/sdk` (déjà encapsulé dans `mob/src/api/base44Client.ts` et `mob/src/api/entities.ts`) :

```ts
import { getBase44 } from '@/api/base44Client';

const base44 = getBase44();
const result = await base44.functions.invoke('createPaymentIntent', {
  amount: 1990,
  currency: 'eur',
  // ...
});
```

Les entités (Product, Order, CartItem, User, ...) sont également exposées via le même SDK :

```ts
const products = await base44.entities.Product.list({ limit: 20 });
```

---

## 11. Comptes & accès (à transférer au client)

Checklist des accès à récupérer auprès de l'équipe sortante :

- [ ] **Compte Expo** (owner actuel : `tezuls`)
  - Option A (recommandée) : transfert d'ownership de l'organisation `tezuls` vers une nouvelle organisation au nom du client
  - Option B : ajout du client comme membre admin de l'organisation existante
  - Le `EAS Project ID` (`501b64d7-fd58-449d-8a1e-046a2d43e7d1`) suit l'organisation
- [ ] **Compte Apple Developer** — Team ID `L2XBYAZYUL`
  - Idéalement, créer un compte Apple Developer Enterprise/Organization au nom du client et **transférer l'app** dans App Store Connect (procédure officielle Apple : « Transfer App »)
  - À défaut, ajouter l'Apple ID du client comme admin de l'équipe existante
- [ ] **Apple ID** `afrigo13kane@gmail.com` (identifiants + accès à la boîte mail pour récupérer les codes 2FA) si la même équipe Apple est conservée
- [ ] **Compte App Store Connect** — accès à l'app `6771119661`
- [ ] **Compte Google Play Console** — accès à l'app `app.afrigo.mobile`
  - Récupérer également le fichier `secrets/play-service-account.json` (compte de service pour `eas submit`)
- [ ] **Compte base44** — accès au projet `6947869a3a13c81a6fad2204`
  - Récupérer la `EXPO_PUBLIC_BASE44_API_KEY`
  - Récupérer les variables backend (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
- [ ] **Compte Stripe** — récupérer `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test + live) et la clé secrète côté base44
  - Migrer le compte Stripe au nom de la société du client si pas déjà fait
- [ ] **Domaine** `afrigo.app`
  - Accès au registrar DNS
  - Hébergement du fichier `.well-known/apple-app-site-association` (pour les Universal Links iOS) et du `assetlinks.json` (pour Android App Links) — déjà déposés
- [ ] **Dépôt Git** — transfert du repo vers l'organisation Git du client

---

## 12. Opérations courantes

### Publier un fix urgent sans rebuild natif

```bash
eas update --branch production --message "Hotfix : <description>"
```

Fonctionne uniquement si les changements sont JS/asset uniquement (pas de nouvelle lib native, pas de modification de `app.json` plugins).

### Ajouter un device iOS pour les builds preview

```bash
eas device:create
```

Suivre le QR code / lien fourni par EAS sur l'iPhone à enregistrer.

### Voir les builds récents

```bash
eas build:list
eas build:view <build-id>
```

### Voir / créer des secrets EAS

```bash
eas secret:list
eas secret:create --scope project --name MY_SECRET --value "..."
```

### Régénérer les dossiers natifs (`android/`, `ios/`)

```bash
npm run prebuild
```

> Attention : `expo prebuild --clean` écrase les modifications faites manuellement dans `android/` ou `ios/`. Ce repo est conçu pour fonctionner en mode « managed + prebuild on demand ».

---

## 13. Spécificités et contraintes connues

- **Ne PAS toucher `mob/.npmrc`** : `legacy-peer-deps=true` est nécessaire pour résoudre les peer deps de SDK 55 (React 19, Reanimated 4, etc.).
- **New Architecture (Fabric / TurboModules)** activée par défaut depuis Expo SDK 55. Toute nouvelle lib native doit être compatible.
- **Reanimated 4** nécessite `react-native-worklets@0.7.4` (déjà installé). Toute mise à jour de Reanimated doit être faite en tandem.
- **Apple submission** : Apple exige depuis 2025 que les apps soient soumises avec Xcode 26+ et le SDK iOS 26+. Le profil `production` dans `eas.json` utilise `"image": "latest"` pour rester à jour. Vérifier régulièrement après une mise à jour de Apple.
- **Windows / Android** : certains scripts npm (`android:winjdk`, `android:bundle:release`, `android:clean-native`) sont des wrappers Node (`scripts/*.cjs`) pour gérer le JDK et nettoyer les caches Gradle sous Windows.
- **expo-updates / runtimeVersion** : la `runtimeVersion` est calée sur `appVersion`. Toute modification de modules natifs (ajout/suppression de lib avec code natif) **invalide les OTA** sur la version courante et impose un nouveau build store.
- **Bundle ID partagé** : `app.afrigo.mobile` est utilisé à la fois pour iOS et Android. Le **Merchant ID Apple Pay** est `merchant.app.afrigo.mobile`.
- **Associated Domain** : `afrigo.app` est déclaré pour les Universal Links iOS et les App Links Android. Si le domaine change, mettre à jour `app.json` (`ios.associatedDomains` et `android.intentFilters`) **et** redéployer les fichiers `apple-app-site-association` + `assetlinks.json`.
- **Secrets Git** : `mob/secrets/play-service-account.json` n'est **pas** versionné. À récupérer hors Git lors de la remise.
- **NativeWind retiré (2026-09-17)** : l'app n'utilise aucun `className`, et le runtime JSX de NativeWind 4.1 (`jsxImportSource: 'nativewind'`) **perdait la `ref`** des composants fonction de RN 0.83 (`ScrollView`, `View`, `Pressable`…) : sur l'appareil, `FlatList/SectionList.scrollTo*`, `ScrollView.scrollTo` et `ref.measure()` ne faisaient rien (flèche « retour en haut », remontée du champ actif au-dessus du clavier), alors que Jest passait. `babel.config.js` / `metro.config.js` sont désormais standards ; `global.css`, `tailwind.config.js`, `nativewind-env.d.ts` supprimés. Ne pas réintroduire NativeWind sans passer en ≥ 4.2 (react-native-css-interop ≥ 0.2 corrige l'ordre `{ ref, ...props }`).
- **Thème clair uniquement** : `app.json` → `userInterfaceStyle: "light"` (et `keyboardAppearance` clair sur les champs). Avant, en mode sombre système, iOS affichait un clavier noir translucide sur les formulaires clairs. Changement natif → nouveau build store.
- **Retours (`Return`)** — règles côté mobile (`mob/src/utils/orderHelpers.ts`, `returnStatus.ts`) :
  - fenêtre de **1 h** après `delivered_date` (`RETURN_WINDOW_HOURS`, fixe ; `AppSettings.return_time_limit_hours` n'est plus lu) ;
  - le bouton « Demander un retour » reste visible tant qu'aucune demande n'est `approved`/`completed` sur la commande (plusieurs demandes possibles) ;
  - formulaire : produit(s) + raison (`wrong_product`/`expired`) + description + **≥ 2 photos prises à l'appareil photo** (pas de galerie) + résolution `exchange`/`refund` (remboursement crédité **sur le portefeuille** par l'admin) ;
  - suivi en 3 étapes En attente → Approuvé → Terminé (`ReturnTracker`), `rejected` = encart de refus avec `rejection_reason` ; `admin_message` affiché au client.
  - **Android et appareil photo** (2026-10-20) : l'appareil photo est une autre application, et Android peut fermer AfriGo pendant la prise de vue — la réclamation en cours « disparaissait » au retour. Le formulaire est gardé en brouillon (`mob/src/utils/returnDraft.ts` : 1 h, par commande et par compte), écrit sur le disque avant d'ouvrir l'appareil photo ; au redémarrage, `ReturnDraftRestorer` rouvre la réclamation (par-dessus sa commande) et `ImagePicker.getPendingResultAsync()` récupère la photo prise. Brouillon effacé à l'envoi. Test sur un téléphone : Options pour les développeurs → « Ne pas conserver les activités ».
  - Schéma vérifiable à tout moment : `GET https://base44.app/api/apps/<appId>/entity-schemas/Return` (header `api_key`).
- **TVA** : les prix sont TTC ; le taux vient de `Product.vat_rate` (recopié dans `CartLine.vatRate` puis `Order.items[].vat_rate`, 0 si jamais renseigné). Panier et récapitulatif affichent HT / TVA / TTC (`mob/src/utils/cartVat.ts`). Les lignes rechargées depuis le serveur (`CartItem` sans TVA) relisent le produit (`useCartVatRates`).
- **Facture** : bouton « Facture » du détail de commande → PDF généré sur l'appareil (`expo-print`) et partagé/enregistré via `expo-sharing` (`mob/src/services/invoice.ts`). Aucune fonction serveur.
- **Icônes de catégories** : `CATEGORY_IMAGES` dans `mob/src/utils/categories.ts` — déposer les visuels dans `mob/assets/categories/<id>.png` et les référencer ; sans entrée, la pastille garde l'emoji.
- **Clavier sur Android (bord à bord, API 35/36)** : `adjustResize` ne rétrécit plus la fenêtre, le clavier recouvrait les derniers champs (Ville à l'inscription). `Screen` applique donc un `KeyboardAvoidingView` en `padding` sur **les deux** plateformes ; un écran qui gère lui-même le clavier passe `keyboardBehavior="none"` et réserve `keyboardHeight` en bas de son ScrollView (inscription : `useKeyboardAwareFields`).
- **Micro Android** : `android.permission.RECORD_AUDIO` doit rester dans `android.permissions` de `app.json` et **jamais** dans `blockedPermissions` (où il était jusqu'à la 1.0.27). Moteur de reconnaissance (`pickAndroidRecognizer` dans `useVoiceProductSearch.ts`) : celui du téléphone s'il s'agit déjà d'un moteur Google en ligne, sinon « Services vocaux de Google » (`com.google.android.tts`) ou l'app Google ; jamais `com.google.android.as` (reconnaissance hors ligne, qui s'arrête sans rien entendre si le pack français n'est pas téléchargé). Le dossier local `mob/android/` (non versionné, ancien) n'est pas utilisé par EAS : `npx expo prebuild --clean -p android` avant tout build Android local. Contrôle sans build : `npx expo config --type introspect`, dossier `android/` mis de côté.
- **Icône de notification Android** : `mob/assets/images/notification-icon.png`, blanc sur transparent (Android ne garde que la silhouette, teintée `#F97316`), 384 px, traits épais lisibles à 24 dp, sans les traits de vitesse du logo. Avant le 2026-10-10 : image vide de 70 octets (icône blanche ou grise) ; jusqu'au 2026-10-20 : traits fins, à peine visibles dans la barre d'état.
- **Modifs en cours non commitées** (au moment de la remise) :
  - `base44/functions/addLoyaltyPointsOnDelivery/entry.ts`
  - `base44/functions/removeLoyaltyPointsOnReturn/entry.ts`
  - `package.json` (racine, web app)

---

## 14. Rejet App Store — actions de resoumission

Dernière review : **build 1.0.9 (16)**, iPad Pro 11-inch (M4), iPadOS 26.5.

### 14.1 Guideline 5.1.2 — App Tracking Transparency

**Pourquoi le rejet persiste :** App Store Connect déclare encore que l'app **track** les utilisateurs, notamment via **Physical Address**. L'adresse sert uniquement à la **livraison** — ce n'est pas du tracking Apple. ATT n'est requis que si vous déclarez du tracking.

**Constat code :** aucun SDK pub, analytics Base44 désactivés, pas de `NSUserTrackingUsageDescription`, GPS retiré de `app.json` (pas de `expo-location`).

**Actions App Store Connect (Account Holder / Admin) :**

1. **App Privacy → Edit**
2. **Does your app track users?** → **No**
3. **Data Used to Track You** → section **vide**
4. **Physical Address** → Linked to You, **App Functionality**, **Used for Tracking = No**
5. Retirer **Precise Location** si non utilisé

### 14.2 Guideline 2.1(a) — Bouton « Se connecter » inactif (iPad + iPhone)

**Vraie cause (build 17 rejeté) :** l'écran Connexion est présenté en **`modal` natif** (`RootNavigator.tsx`, `presentation: 'modal'`). Or `react-native-toast-message` (`<Toast/>`) est monté à la **racine React**, donc **sous** la modale native iOS. Tous les retours d'erreur passaient par des **Toasts invisibles** derrière la modale → en cas d'échec de connexion (mauvais identifiants / pas de compte test), le bouton semblait **ne rien faire**.

**Correctif code (build 18 / v1.0.10) :** `LoginScreen.tsx` — tous les retours utilisateur (échec connexion, reset, navigateur) passent par `Alert.alert` natif (toujours au-dessus de la modale). Validation déjà en **erreurs inline** sous les champs. Bouton dans le ScrollView + `keyboardShouldPersistTaps="always"`.

**Review Notes :**

> Login: enter email + password (min 6 characters), then tap « Se connecter ». Invalid input shows a red error under the field; failed login shows a native alert. Test account: [email + mot de passe] — or tap « Continuer en invité » to browse without an account.

### 14.3 Apple Pay (si demandé)

Checkout → Carte bancaire → Paiement → PaymentSheet Stripe. Merchant ID : `merchant.app.afrigo.mobile`.

### 14.4 Build et soumission

```bash
cd mob
npm run build:ios:prod
eas submit -p ios --latest
```

---

## 15. Liens utiles

- Expo docs : https://docs.expo.dev/
- EAS Build : https://docs.expo.dev/build/introduction/
- EAS Submit : https://docs.expo.dev/submit/introduction/
- EAS Update (OTA) : https://docs.expo.dev/eas-update/introduction/
- App Store Connect : https://appstoreconnect.apple.com/
- Apple Developer : https://developer.apple.com/account
- Google Play Console : https://play.google.com/console
- Stripe Dashboard : https://dashboard.stripe.com/
- React Navigation : https://reactnavigation.org/docs/getting-started
- NativeWind : https://www.nativewind.dev/
- base44 : (à compléter par le client — URL de console et documentation à demander à l'équipe sortante)
