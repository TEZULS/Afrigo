import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Cartographie des routes mobiles d'AfriGo, en miroir des `pageName` du web.
 */

export type ClientTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  CartTab: undefined;
  /** Onglet 🔍 : ouvre l'écran de recherche plein écran (route racine `Search`). */
  SearchTab: undefined;
  /** Onglet 🔔 : fil de notifications (suivi commandes + service client). */
  NotificationsTab: undefined;
  /**
   * Conservés pour la navigation programmatique (menu latéral, deep links) :
   * ces onglets ne sont plus affichés dans la barre du bas depuis que le
   * menu est passé en haut de l'accueil.
   */
  ProfileTab: undefined;
  MenuTab: undefined;
};

type WebViewParams = { route: string; title?: string } | undefined;

export type AdminDrawerParamList = {
  AdminDashboard: undefined;
  AdminOrders: WebViewParams;
  AdminProducts: WebViewParams;
  AdminUsers: WebViewParams;
  AdminMessages: WebViewParams;
  AdminWebView: WebViewParams;
};

export type DelivererStackParamList = {
  DelivererLogin: undefined;
  DelivererDashboard: undefined;
  DelivererOrderDetails: { id: string };
};

export type RootStackParamList = {
  Bootstrap: undefined;
  Onboarding: undefined;

  // Client
  ClientTabs: NavigatorScreenParams<ClientTabParamList>;
  /** Recherche plein écran (suggestions + historique). */
  Search: undefined;
  ProductDetails: { id: string };
  Promotions: undefined;
  /** Nouveautés du catalogue (7 derniers jours), « Voir + » de l'accueil. */
  NewProducts: undefined;
  /** Recettes d'Afrique : liste des pays, recettes d'un pays, détail. */
  Recipes: { country?: string; recipeId?: string } | undefined;
  /** `lineKeys` : lignes du panier cochées (`cartLineKey`) ; absent = tout le panier. */
  Checkout: { lineKeys?: string[] } | undefined;
  /**
   * `amount` = reste à régler par carte ; `walletAmount` = part réglée par le
   * portefeuille, débitée seulement une fois le paiement carte confirmé.
   */
  Payment: { orderId: string; amount: number; walletAmount?: number; lineKeys?: string[] };
  PaymentMethods: undefined;
  Orders: undefined;
  OrderDetails: { id: string };
  AllReviews: { productId: string };
  HabitualProducts: undefined;
  Returns: { orderId: string };
  MyReturns: undefined;
  ReturnDetails: { id: string };
  MyRefunds: undefined;
  ProductRequests: undefined;
  Contact: undefined;
  Messages: undefined;
  CustomerMessages: { customerId?: string } | undefined;
  Notifications: undefined;
  Profile: undefined;
  ProfileEdit: undefined;
  /** Page « Paramètres » : Paiement / Mes retours / Mes remboursements / Contrat. */
  Settings: undefined;
  /** Règlement intérieur + politique de confidentialité (consultation). */
  Legal: undefined;

  // Auth
  Login: { initialMode?: 'login' | 'register' } | undefined;
  UserNotRegistered: undefined;

  // Admin
  AdminLogin: undefined;
  AdminDashboard: undefined;
  AdminDrawer: NavigatorScreenParams<AdminDrawerParamList>;

  // Deliverer
  DelivererStack: NavigatorScreenParams<DelivererStackParamList>;
  DelivererLogin: undefined;
  DelivererDashboard: undefined;
  DelivererOrderDetails: { id: string };
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
