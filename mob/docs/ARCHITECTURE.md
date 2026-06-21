# Architecture cible — AfriGo Mobile (React Native / Expo)

> Document maître produit par l'équipe d'agents : audit, UX, architecture,
> migration, qualité. Sert de référence pour tout développement futur.

---

## 1. Vue d'ensemble

| Plan                  | Choix                                                           | Justification                                              |
| --------------------- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| Framework             | **Expo SDK 52** (managed → bare possible via `expo prebuild`)   | EAS Build officiel iOS + Android, OTA updates, dev client. |
| Langage               | **TypeScript strict**                                           | Lisibilité, refactor sûr, compatibilité shadcn-like.       |
| Navigation            | **React Navigation v7** (native-stack + bottom-tabs + drawer)   | Standard mobile, deep linking + stack natif iOS / Android. |
| Styling               | **NativeWind v4 (Tailwind RN)** + tokens centralisés (`theme/`) | Réutilise les classes Tailwind du projet web → migration rapide. |
| State serveur         | **TanStack Query v5**                                           | Même API que côté web (déjà intégré au projet).            |
| State client          | **Zustand** + persist MMKV                                      | Léger, idéal pour panier invité.                           |
| Auth                  | **Base44 SDK + expo-secure-store + expo-web-browser**           | Le SDK est isomorphe, on lui fournit le token via deep link. |
| Paiement              | **@stripe/stripe-react-native** (PaymentSheet)                  | Apple Pay, Google Pay, 3DS natifs — remplace `react-stripe-js`. |
| Cartes                | **react-native-maps**                                           | Remplace `react-leaflet` web.                              |
| Animations            | **react-native-reanimated v3 + Moti**                           | Remplace `framer-motion`.                                  |
| Notifications         | **expo-notifications**                                          | FCM (Android) + APNs (iOS).                                |
| OTA                   | **expo-updates**                                                | Remplace l'`UpdatePrompt` PWA, déploiement instantané.     |
| Stockage              | **react-native-mmkv** + **expo-secure-store** + AsyncStorage    | Perf, sécurité, compat persister.                          |
| Charts admin          | **victory-native**                                              | Remplace `recharts` (compatible Reanimated).               |
| Bottom sheets         | **@gorhom/bottom-sheet**                                        | CartSheet, filter sheet, sélections fluides.               |
| Toasts                | **react-native-toast-message**                                  | Sonner / shadcn equivalent.                                |
| Form                  | **react-hook-form + zod** (déjà côté web)                       | Réutilisation directe.                                     |
| WebView (admin lourd) | **react-native-webview**                                        | Stratégie hybride pour 22 écrans admin avancés.            |

---

## 2. Structure de dossiers

```
mob/
├── App.tsx                  # Providers racine
├── index.ts                 # Point d'entrée (registerRootComponent)
├── app.json                 # Config Expo (iOS + Android, permissions, plugins)
├── eas.json                 # Profils EAS Build (dev / preview / prod)
├── babel.config.js          # Babel + nativewind + reanimated + module-resolver
├── metro.config.js          # Metro + nativewind + alias @/*
├── tailwind.config.js       # Tokens + presets NativeWind
├── tsconfig.json            # TS strict + paths
├── global.css               # CSS variables NativeWind
├── assets/
│   ├── images/              # icon, splash, adaptive-icon, notification-icon
│   └── fonts/               # Inter (optionnel)
└── src/
    ├── api/                 # Couche Base44
    │   ├── base44Client.ts  # Adaptateur RN (token SecureStore + hydrate)
    │   └── entities.ts      # Façade entities + functions + integrations
    ├── lib/
    │   ├── AuthContext.tsx  # Auth OAuth Base44 via deep link
    │   └── query-client.ts  # TanStack Query + NetInfo + AppState
    ├── theme/
    │   ├── tokens.ts        # palette + lightTheme/darkTheme + radius/spacing
    │   └── ThemeProvider.tsx
    ├── navigation/
    │   ├── types.ts         # ParamLists typés (Root, Client, Admin, Deliverer)
    │   ├── linking.ts       # Deep linking afrigo:// + https://afrigo.app
    │   ├── RootNavigator.tsx
    │   ├── ClientTabs.tsx
    │   ├── AdminDrawer.tsx
    │   └── DelivererStack.tsx
    ├── components/
    │   ├── ui/              # Button, Card, Input, Badge, Skeleton, Avatar,
    │   │                    # EmptyState, Header, Loader, Screen
    │   ├── products/        # ProductCard, CategoryFilter
    │   ├── orders/          # OrderTracker, OrderStatusBadge
    │   ├── profile/         # TierBadge
    │   ├── cart/            # CartSheet (BottomSheet)
    │   └── ErrorBoundary.tsx
    ├── screens/
    │   ├── auth/            # LoginScreen, UserNotRegisteredScreen
    │   ├── client/          # 17 écrans client
    │   ├── deliverer/       # 3 écrans livreur
    │   └── admin/           # AdminLogin + AdminDashboard + AdminWebView
    ├── hooks/               # useAppSettings, useToast
    ├── stores/              # cart (Zustand + MMKV)
    ├── services/            # storage (MMKV + SecureStore + AsyncStorage)
    ├── utils/               # cn, format, routes (mapping pageName → route)
    ├── config/              # env (variables EXPO_PUBLIC_*)
    └── types/               # Types globaux (extensible)
```

---

## 3. Authentification

```
                      ┌────────────────────┐
                      │  LoginScreen       │
                      │  loginWithBase44() │
                      └─────────┬──────────┘
                                │
                                ▼
       expo-web-browser.openAuthSessionAsync()
                                │
                ┌───────────────┼─────────────────┐
                │               │                 │
                ▼               ▼                 ▼
      afrigo.app/login   ASWebAuthenticationSession  Custom Tabs
                                │
                                ▼
                Redirect → afrigo://auth?access_token=...
                                │
                                ▼
              Linking event   →  setBase44Token(token)
                                │
                                ▼
                expo-secure-store.setItemAsync()
                                │
                                ▼
                  base44.auth.me() → setUser()
```

Le SDK Base44 reste isomorphe : on lui injecte le token au build du client.
Aucun fichier original n'est modifié — on encapsule.

---

## 4. Paiement (Stripe)

Le projet web utilise `@stripe/react-stripe-js` + `Elements`. En mobile :

1. `CheckoutScreen` crée la commande via `Order().create()`.
2. Appel à la cloud function `createPaymentIntent` (Base44) pour récupérer
   `clientSecret`, `customerId` et `ephemeralKey`.
3. `useStripe().initPaymentSheet()` puis `presentPaymentSheet()` ouvrent une
   feuille native qui supporte Apple Pay, Google Pay, 3DS et cartes manuelles.
4. Sur succès, `OrderDetailsScreen` est affiché.

Avantages : pas de WebView, pas de frame externe, conformité PCI native.

---

## 5. Stratégie hybride pour le panneau Admin

L'audit a identifié 38 écrans admin. Ils sont catégorisés en :

| Bucket                    | Nb | Approche                                                 |
| ------------------------- | -- | -------------------------------------------------------- |
| **Natif RN immédiat**     | 5  | Migration complète (`AdminDashboard`, `AdminLogin`, …).  |
| **Natif RN simplifié**    | 22 | Composants RN avec adaptations légères (recharts → victory, framer-motion → reanimated, confirm → Alert.alert). À réaliser au fil de l'eau, voir `MIGRATION.md`. |
| **WebView fallback (V1)** | 11 | Délégation au panel web pour ne pas bloquer la sortie. Ces écrans dépendent de `window.print`, `document.write`, `window.AudioContext`, `qrcode`/canvas, `@hello-pangea/dnd`. La WebView injecte le token Base44 via `injectedJavaScriptBeforeContentLoaded`. |

L'utilisateur final (admin) ne voit qu'une seule app : la WebView est nichée
dans le drawer admin. À tout moment on peut migrer un écran admin de WebView
vers du natif sans changer la navigation.

---

## 6. Identité visuelle

Tous les tokens du web (`src/index.css`) sont reportés dans `src/theme/tokens.ts` :

- Background blanc `#FFFFFF` / Foreground slate `#0F172A`.
- Brand orange `#F97316` (boutons primaires CTA, badges actifs).
- Brand orange foncé `#EA580C` (états pressed).
- Brand vert `#008000` (boutons « Ajouter au panier », identité AfriGo).
- Slate 50/100/200/… pour les surfaces neutres.
- Cards arrondies (`16-20-24`), shadows `sm/md/lg/xl` adaptés aux deux plateformes
  (`shadowOffset`/`shadowOpacity` iOS + `elevation` Android).
- Police système avec poids 400-800 (typographie Inter possible via
  `expo-font` si nécessaire).

Le `ThemeProvider` détecte automatiquement le mode clair/sombre du système
(via `Appearance`) et expose les valeurs aux composants.

---

## 7. Performance & UX mobile

- **FlashList / FlatList** virtualisée pour la grille produits.
- **expo-image** avec cache disque pour les images Base44 (souvent S3).
- **Pull-to-refresh** natif sur Home, Orders, MyReturns, MyRefunds, Messages.
- **Bottom sheet** (`@gorhom/bottom-sheet`) pour le panier glissant — UX
  identique à un drawer mais 100 % gestes natifs.
- **Safe area** gérée par `react-native-safe-area-context` (encoche iPhone, gestes Android).
- **Skeletons** (Reanimated) pour les états de chargement.
- **Toasts** non bloquants pour les succès / erreurs.
- **Status bar** dynamique selon le scheme.

---

## 8. Offline & résilience

- TanStack Query est synchronisé avec NetInfo (`onlineManager`) → les requêtes
  sont rejouées automatiquement à la reconnexion.
- Le panier persiste hors-ligne dans MMKV — visible même sans réseau.
- Le `ErrorBoundary` racine intercepte tous les crashs et propose un
  rechargement (en prod : `Updates.reloadAsync()`).
- L'état `MaintenanceScreen` est piloté par `AppSettings.is_available`
  (équivalent strict du web).

---

## 9. Sécurité

- Token Base44 → **expo-secure-store** (Keychain iOS / EncryptedSharedPreferences Android).
- Aucune clé secrète Stripe / Base44 dans le bundle. Toutes les opérations
  sensibles passent par les **cloud functions Base44** existantes.
- HTTPS forcé via `app.json` (App Transport Security activé par défaut iOS 14+).
- Permissions runtime conformes (caméra, photos, localisation, notifications)
  avec strings d'usage en français.

---

## 10. Build & déploiement

| Plateforme | Cible          | Profil EAS    | Sortie            |
| ---------- | -------------- | ------------- | ----------------- |
| Android    | Test interne   | `preview`     | `.apk`            |
| Android    | Production     | `production`  | `.aab` (Play Store) |
| iOS        | Simulateur     | `development` | Simulator build   |
| iOS        | TestFlight     | `preview`     | `.ipa` ad-hoc     |
| iOS        | App Store      | `production`  | `.ipa`            |

Commandes :

```bash
npm run build:android:preview
npm run build:android:prod
npm run build:ios:preview
npm run build:ios:prod
npm run submit:android
npm run submit:ios
```

OTA :

```bash
eas update --branch production --message "Hotfix #1234"
```

---

## 11. Roadmap recommandée (post-MVP)

1. Sprint 1 : finir Stripe + tests sur device réel iOS/Android.
2. Sprint 2 : push notifications (expo-notifications + entité `NotificationSettings`).
3. Sprint 3 : migration des 22 écrans admin "simplifiés" → natif (priorité OrdersAdmin, ProductsAdmin, UsersAdmin).
4. Sprint 4 : migration des écrans à `window.print` → `expo-print` + `expo-sharing`.
5. Sprint 5 : pipeline CI/CD GitHub Actions → EAS Build automatique sur tag.
6. Sprint 6 : analytics offline (file d'événements MMKV → flush en ligne).
