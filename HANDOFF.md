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
| Styling           | NativeWind (Tailwind CSS)                | 4.1.23        |
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
│   ├── tailwind.config.js        # Config NativeWind
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
| Version                              | `1.0.9`                                      |
| Bundle ID iOS                        | `app.afrigo.mobile`                          |
| Build number iOS                     | `7` (auto-incrémenté sur `production`)       |
| Package Android                      | `app.afrigo.mobile`                          |
| versionCode Android                  | `9` (auto-incrémenté sur `production`)       |
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

### 10.2 Variables d'env. côté backend

Ces variables sont configurées dans l'interface base44 (pas dans le repo) :

- `STRIPE_SECRET_KEY` — clé secrète Stripe (jamais exposée au mobile)
- `STRIPE_API_KEY` — alias / variante selon les fonctions
- `STRIPE_WEBHOOK_SECRET` — signature des webhooks Stripe

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
- **Modifs en cours non commitées** (au moment de la remise) :
  - `base44/functions/addLoyaltyPointsOnDelivery/entry.ts`
  - `base44/functions/removeLoyaltyPointsOnReturn/entry.ts`
  - `package.json` (racine, web app)

---

## 14. Liens utiles

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
