# Plan de migration — Web → Mobile (AfriGo)

> Cartographie écran par écran, telle que produite par les agents d'audit.

Légende :

- ✅ **Natif RN livré** dans ce bootstrap.
- 🟡 **Squelette livré** : structure RN en place, à étoffer (logique métier
  identique au web mais à brancher sur les détails finaux).
- 🌐 **WebView V1** : route déléguée au panel web via `AdminWebViewScreen`
  (token Base44 injecté). Migration native planifiée.
- ❌ **Non requis mobile** : couche purement web (PWA, scroll restoration, …).

---

## 1. Écrans CLIENT (17)

| Web (src/pages)         | Mobile (src/screens/client)              | État | Notes                                                  |
| ----------------------- | ----------------------------------------- | ---- | ------------------------------------------------------ |
| Home.jsx                | HomeScreen.tsx                            | ✅   | Recherche, mode food/cosmétique, catégories, panier.   |
| ProductDetails.jsx      | ProductDetailsScreen.tsx                  | ✅   | Variantes, promo, avis, bouton sticky add-to-cart.     |
| (modal cart)            | CartScreen.tsx + CartSheet.tsx           | ✅   | BottomSheet + écran plein, persistance MMKV.           |
| Checkout.jsx            | CheckoutScreen.tsx                        | ✅   | Adresse, zone, créneau, paiement, totaux, mutation.    |
| Payment.jsx             | PaymentScreen.tsx                         | ✅   | Stripe PaymentSheet (Apple Pay / Google Pay / 3DS).    |
| Orders.jsx              | OrdersScreen.tsx                          | ✅   | Liste paginée + statut + pull-to-refresh.              |
| OrderDetails.jsx        | OrderDetailsScreen.tsx                    | ✅   | Tracker, react-native-maps, retours, support.          |
| Profile.jsx             | ProfileScreen.tsx                         | ✅   | Avatar, tier, menu, support, accès admin/livreur.      |
| Promotions.jsx          | PromotionsScreen.tsx                      | ✅   | Filtre `is_promotion`.                                 |
| AllReviews.jsx          | AllReviewsScreen.tsx                      | ✅   | Liste avis par produit + étoiles.                      |
| HabitualProducts.jsx    | HabitualProductsScreen.tsx                | ✅   | Agrégation depuis l'historique commandes.              |
| Returns.jsx             | ReturnsScreen.tsx                         | ✅   | Sélection items + photos via expo-image-picker.        |
| MyReturns.jsx           | MyReturnsScreen.tsx                       | ✅   | Liste + statut.                                        |
| ReturnDetails.jsx       | ReturnDetailsScreen.tsx                   | ✅   | Détail retour avec photos.                             |
| MyRefunds.jsx           | MyRefundsScreen.tsx                       | ✅   | Historique remboursements.                             |
| ProductRequests.jsx     | ProductRequestsScreen.tsx                 | ✅   | Création + suivi des demandes.                         |
| Messages.jsx            | MessagesScreen.tsx                        | ✅   | Chat support (polling 10s, KeyboardAvoidingView).      |
| CustomerMessages.jsx    | CustomerMessagesScreen.tsx                | ✅   | Redirige vers MessagesScreen (UX mobile simplifiée).   |

### Composants client réutilisés

| Web                                | Mobile                                       | État |
| ---------------------------------- | -------------------------------------------- | ---- |
| ProductCard.jsx                    | components/products/ProductCard.tsx          | ✅   |
| CategoryFilter.jsx                 | components/products/CategoryFilter.tsx       | ✅   |
| OrderTracker.jsx                   | components/orders/OrderTracker.tsx           | ✅   |
| OrderStatusBadge.jsx               | components/orders/OrderStatusBadge.tsx       | ✅   |
| CartDrawer.jsx                     | components/cart/CartSheet.tsx                | ✅   |
| TierBadge.jsx                      | components/profile/TierBadge.tsx             | ✅   |
| ReturnTracker.jsx                  | (intégré dans ReturnDetailsScreen)           | 🟡   |
| ReferralSection.jsx                | À ajouter dans ProfileScreen                 | 🟡   |
| WelcomeReferralDialog.jsx          | À ajouter en modal Profile                   | 🟡   |
| InstallGuideModal / InstallPWA     | ❌ Non pertinent (App Store / Play Store)    | ❌   |
| UpdatePrompt.jsx                   | Remplacé par expo-updates dans App.tsx       | ✅   |
| MaintenanceMode.jsx                | screens/client/MaintenanceScreen.tsx          | ✅   |
| NotificationListener.jsx           | À implémenter via expo-notifications         | 🟡   |
| VisitorTracker.jsx                 | À implémenter (entité Visitor)               | 🟡   |
| PrivacyPolicyDialog                | À adapter en BottomSheet (Profile / boot)    | 🟡   |
| InternalRegulationsDialog          | Idem                                         | 🟡   |
| WelcomeMessageDialog               | Idem                                         | 🟡   |
| PullToRefresh.jsx                  | RefreshControl natif déjà câblé              | ✅   |
| BottomTabBar.jsx                   | navigation/ClientTabs.tsx                    | ✅   |
| ErrorBoundary.jsx                  | components/ErrorBoundary.tsx                 | ✅   |
| UserNotRegisteredError.jsx         | screens/auth/UserNotRegisteredScreen.tsx     | ✅   |
| Layout.jsx                         | RootNavigator + Screen + Header              | ✅   |

---

## 2. Écrans LIVREUR (3)

| Web                       | Mobile                                              | État |
| ------------------------- | --------------------------------------------------- | ---- |
| DelivererLogin.jsx        | screens/deliverer/DelivererLoginScreen.tsx          | ✅   |
| DelivererDashboard.jsx    | screens/deliverer/DelivererDashboardScreen.tsx      | ✅   |
| DelivererOrderDetails.jsx | screens/deliverer/DelivererOrderDetailsScreen.tsx   | ✅   |

Adaptations clés :

- `URLSearchParams(window.location.search)` → token via `setBase44Token`.
- `window.open('https://www.google.com/maps/...')` → `Linking.openURL(...)`.
- `confirm()` → `Alert.alert(...)`.

---

## 3. Écrans ADMIN (38)

### Bucket A — Natif RN livré (5)

| Web                  | Mobile                                | État |
| -------------------- | ------------------------------------- | ---- |
| AdminLogin.jsx       | screens/admin/AdminLoginScreen.tsx    | ✅   |
| AdminDashboard.jsx   | screens/admin/AdminDashboardScreen.tsx | ✅  |

### Bucket B — Natif RN simplifié à migrer (22)

Pour ces écrans la logique métier est triviale à porter (CRUD via Base44),
mais ils nécessitent des adaptations légères. Sprint planifié :

| Web                          | Adaptations RN à effectuer                                        |
| ---------------------------- | ----------------------------------------------------------------- |
| AdminBroadcast               | recharts → victory-native, confirm → Alert                        |
| AdminCarts                   | Tableau virtualisé, drag & drop → simple swipe                    |
| AdminCustomerHistory         | Charts + impression → expo-print                                  |
| AdminDelivererPreview        | Pas de spécificité                                                |
| AdminDelivererTracking       | react-leaflet → react-native-maps                                 |
| AdminDeliverers              | Pas de spécificité                                                |
| AdminDeliverySlots           | Calendrier → react-native-calendars                               |
| AdminDeliveryZones           | Polygones map → react-native-maps                                 |
| AdminInternalRegulations     | react-quill → react-native-pell-rich-editor                       |
| AdminInviteUser              | Pas de spécificité                                                |
| AdminLoyalty                 | Pas de spécificité                                                |
| AdminManagement              | Drag & drop @hello-pangea/dnd → SwipeableRow                      |
| AdminManualAssignment        | Pas de spécificité                                                |
| AdminMessages                | Liste virtualisée + chat                                          |
| AdminNotificationTemplates   | Riche editor → simple TextInput markdown                          |
| AdminPayment                 | Stripe Connect dashboard → WebView ciblée                         |
| AdminPrivacyPolicy           | react-quill → markdown editor                                     |
| AdminProductRequests         | Pas de spécificité                                                |
| AdminPromoCodes              | Pas de spécificité                                                |
| AdminReferralSettings        | Pas de spécificité                                                |
| AdminReferrals               | Pas de spécificité                                                |
| AdminRevenueHistory          | recharts → victory-native                                         |
| AdminReviews                 | Pas de spécificité                                                |
| AdminSettings                | Switches RN, color pickers spécifiques                            |
| AdminTiers                   | Pas de spécificité                                                |
| AdminTopCustomers            | Pas de spécificité                                                |
| AdminUsers                   | Pas de spécificité                                                |
| AdminVisitors                | recharts → victory-native                                         |

### Bucket C — WebView V1 (11)

Délégués à `AdminWebViewScreen` à court terme, native plus tard :

| Web                  | Raison                                                         |
| -------------------- | -------------------------------------------------------------- |
| AdminOrders          | Impression bordereau (`window.print`)                          |
| AdminProducts        | Drag & drop catégories + bulk edit                             |
| AdminWallet          | Impression + `window.print`                                    |
| AdminWalletHistory   | Tables denses + `window.print`                                 |
| AdminNotifications   | `window.AudioContext` (synthèse sonore)                        |
| AdminQRCode          | Génération QR via `qrcode` Canvas (→ `react-native-qrcode-svg`) |
| AdminReturns         | Charts + impression                                            |
| AdminWelcomeMessage  | Riche editor                                                   |
| AdminInternalRegulations | (variant éditeur)                                          |
| (OrderPrintBordereau)| `document.write` + `window.print`                              |

---

## 4. Cloud functions Base44 (21) — utilisées telles quelles

| Fonction                              | Utilisation mobile                            |
| ------------------------------------- | --------------------------------------------- |
| `createPaymentIntent`                 | PaymentScreen → Stripe initPaymentSheet       |
| `saveCard` / `deleteCard`             | À brancher dans Profile → cartes              |
| `updateStockAfterOrder`               | CheckoutScreen.placeOrder onSuccess           |
| `restoreStockAfterCancellation`       | À utiliser depuis OrderDetails (annulation)   |
| `notifyAdminsNewOrder`                | CheckoutScreen.placeOrder onSuccess           |
| `sendOrderNotification`               | À brancher avec NotificationListener          |
| `sendOrderStatusEmail`                | Coté backend (cron / webhook)                 |
| `sendNotDeliveredNotification`        | DelivererOrderDetailsScreen status not_delivered |
| `sendCustomInvitation`                | Admin                                         |
| `handleCustomAuth`                    | AdminLogin + DelivererLogin                   |
| `addLoyaltyPointsOnDelivery`          | DelivererOrderDetailsScreen.delivered         |
| `removeLoyaltyPointsOnCancellation`   | À brancher (admin)                            |
| `removeLoyaltyPointsOnReturn`         | À brancher (admin)                            |
| `calculateLoyaltyPoints`              | À brancher dans Profile                       |
| `resetExpiredPoints`                  | Cron                                          |
| `archiveDailyCash`                    | Cron                                          |
| `archiveMonthlyRevenue`               | Cron                                          |
| `processCardRefund`                   | Admin (Refund flow)                           |
| `testStripeConnection`                | AdminSettings → bouton test                   |
| `webhookStripe`                       | Backend                                       |

---

## 5. Dépendances web → équivalents RN

| Web                      | Mobile                              | Notes                                         |
| ------------------------ | ----------------------------------- | --------------------------------------------- |
| react-router-dom         | @react-navigation/*                 | ✅ migré                                      |
| @stripe/react-stripe-js  | @stripe/stripe-react-native         | ✅ migré (PaymentSheet)                       |
| react-leaflet + leaflet  | react-native-maps                   | ✅ migré (OrderDetails, Deliverer)             |
| framer-motion            | react-native-reanimated v3 + Moti   | ✅ partiel (skeletons + transitions)          |
| recharts                 | victory-native@40.x + @shopify/react-native-skia@1.5.x | 🟡 à intégrer dans charts admin. **Important** : victory-native 41+ exige React 19 (incompatible Expo SDK 52, qui est sur React 18.3). Lors de l'intégration : `npx expo install victory-native@^40 @shopify/react-native-skia@~1.5.0`. |
| react-quill              | react-native-pell-rich-editor       | 🟡 sur AdminInternalRegulations / AdminPrivacyPolicy |
| jspdf + html2canvas      | expo-print + expo-sharing           | 🟡 pour AdminOrders / Wallet                  |
| qrcode                   | react-native-qrcode-svg             | 🟡 pour AdminQRCode                           |
| @hello-pangea/dnd        | react-native-draggable-flatlist     | 🟡                                            |
| canvas-confetti          | (facultatif) react-native-confetti  | ❌ non critique                               |
| html2canvas              | expo-print                          | 🟡                                            |
| input-otp                | react-native-confirmation-code-field| 🟡 si OTP requis côté mobile                  |
| react-day-picker         | @react-native-community/datetimepicker | 🟡                                          |
| moment                   | date-fns (déjà utilisé)             | ✅ remplacé                                   |
| three                    | three.js + expo-gl-cpp              | ❌ non requis (déps morte)                    |
| canvas-confetti / jspdf / html2canvas / @hello-pangea/dnd / react-quill | — | ❌ déps mortes côté web (cf. audit) |

---

## 6. Stockage web → mobile

| Clé localStorage / sessionStorage     | Équivalent RN                       |
| ------------------------------------- | ----------------------------------- |
| `base44_access_token`                 | expo-secure-store (clé identique)   |
| `base44_app_id`                       | MMKV                                |
| `guestCart`                           | MMKV (Zustand persist)              |
| `home_*` (filters, search, scrollPos) | MMKV                                |
| `scrollPos:<route>`                   | useScrollToTop + MMKV par route     |
| `regulationsAcceptances`              | MMKV                                |
| `privacyPolicyAcceptances`            | MMKV                                |

---

## 7. Bugs détectés et corrigés/notés

- ❌ `src/components/ProtectedRoute.jsx` (web) référence `checkUserAuth` et
  `authChecked` qui n'existent **pas** dans `AuthContext`. Le composant est
  cassé → on ne le porte pas.
- ⚠️ Dépendances mortes côté web (zéro usage) :
  `jspdf`, `html2canvas`, `canvas-confetti`, `@hello-pangea/dnd`, `react-quill`.
  Non installées dans le mobile.
- ⚠️ La clé `VITE_BASE44_API_KEY` est exposée par design Base44 (clé applicative
  publique). Elle reste exposée côté mobile via `EXPO_PUBLIC_BASE44_API_KEY`.
  Toute opération sensible doit transiter par les cloud functions (et c'est
  déjà le cas : Stripe, auth, fidélité, stock, refunds).
