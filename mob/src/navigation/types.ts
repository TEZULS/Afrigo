import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Cartographie des routes mobiles d'AfriGo, en miroir des `pageName` du web.
 */

export type ClientTabParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  CartTab: undefined;
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
  ProductDetails: { id: string };
  Promotions: undefined;
  Checkout: undefined;
  Payment: { orderId: string; amount: number };
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
  Profile: undefined;
  ProfileEdit: undefined;

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
