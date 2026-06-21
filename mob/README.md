# AfriGo Mobile

> Application mobile officielle AfriGo (iOS + Android) construite en
> **React Native + Expo SDK 52 + TypeScript**, avec EAS Build.
>
> Migrée à partir du projet web React/Vite/shadcn/Base44 d'origine, en
> conservant l'identité visuelle, les fonctionnalités métier et l'expérience
> utilisateur.

Le dossier de l’application mobile est nommé **`mob/`** (chemin court, important pour CMake / Ninja sous Windows). Si tu récupères encore un dossier **`mobile-expo-bootstrap`**, ferme Cursor et les terminaux ouverts dessus puis renomme-le : depuis la racine du dépôt, **`mv mobile-expo-bootstrap mob`** (Git Bash) ou **`rename mobile-expo-bootstrap mob`** (cmd). Ensuite **`npm run android:clean-native`** pour supprimer les caches Gradle qui gardent encore l’ancien chemin absolu.

## Démarrage rapide

```bash
cd mob

# 1. Installer les dépendances
npm install

# 2. Copier les variables d'environnement
cp .env.example .env
# puis renseigner EXPO_PUBLIC_BASE44_APP_ID, EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY, …

# 3. Lancer en développement
npm run start          # Expo Go / Dev Client
npm run android        # Build Gradle + device / émulateur
npm run ios            # Xcode (Mac uniquement)

npm run android:winjdk # Windows : JDK 17 + SDK Android + fichier android/local.properties (voir docs/ANDROID_WINDOWS.md)

# 4. Vérifier la qualité
npm run typecheck
npm run lint
```

Sur **Windows**, Gradle a besoin d’un **JDK 17** avec `javac`, et du **Android SDK** (via Android Studio). Si le build échoue (Java ou « SDK location not found »), voir **[docs/ANDROID_WINDOWS.md](docs/ANDROID_WINDOWS.md)** et utilise `npm run android:winjdk`.

## Builds iOS / Android (EAS)

```bash
# Initialisation EAS (une seule fois)
npx eas init                       # crée le projet EAS et renseigne app.json
npx eas device:create              # enregistre les UDID iOS internes

# Builds internes (APK + simulateur iOS)
npm run build:android:preview
npm run build:ios:preview

# Builds production (AAB + IPA pour stores)
npm run build:android:prod
npm run build:ios:prod

# Soumission stores
npm run submit:android
npm run submit:ios

# OTA updates (sans rebuild)
npx eas update --branch production --message "Fix #1234"
```

## Structure

Voir [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) pour la vue exhaustive.

```
src/
  api/          # Base44 SDK (token SecureStore + entities + functions)
  lib/          # AuthContext, query-client
  theme/        # tokens (palette, radius, spacing, typography, shadow)
  navigation/   # Root + ClientTabs + AdminDrawer + DelivererStack + linking
  components/
    ui/         # UI kit (Button, Card, Input, Badge, Skeleton, Avatar, Loader, EmptyState, Header, Screen)
    products/   # ProductCard, CategoryFilter
    orders/     # OrderTracker, OrderStatusBadge
    profile/    # TierBadge
    cart/       # CartSheet
  screens/
    auth/       # LoginScreen, UserNotRegisteredScreen
    client/     # 17 écrans
    deliverer/  # 3 écrans
    admin/      # AdminLogin + AdminDashboard + AdminWebView
  hooks/        # useAppSettings, useToast
  stores/       # cart (Zustand + MMKV)
  services/     # storage (MMKV + SecureStore)
  utils/        # cn, format, routes
  config/       # env
```

## Documentation

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Stack, choix techniques, sécurité, perf.
- [docs/MIGRATION.md](./docs/MIGRATION.md) — Plan de migration écran par écran (web → mobile).

## Identité visuelle

- Orange `#F97316` (primaire CTA) / `#EA580C` (pressed).
- Vert AfriGo `#008000` (boutons « Ajouter au panier », identité).
- Fond blanc / surfaces `slate-50`.
- Cards arrondies (`16-20-24`), shadows iOS+Android.
- Mode clair par défaut, mode sombre opt-in (`ThemeProvider`).

## Compatibilité

- **iOS** 15.1+
- **Android** API 24+ (Android 7.0)
- **New Architecture** activée (Fabric + TurboModules)
- **Hermes** activé

## Licence

Propriétaire — AfriGo. Tous droits réservés.
