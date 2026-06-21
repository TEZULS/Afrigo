/**
 * Mapping pageName ↔ route React Navigation, en miroir de createPageUrl(...) du web.
 *
 * Sur le web, AfriGo utilise des URLs comme /ProductDetails?id=xyz. En RN on conserve
 * la même clé logique (pageName) mais avec une vraie route nommée + params typés.
 */

import type { RootStackParamList } from '@/navigation/types';

export const PAGE_TO_ROUTE: Record<string, keyof RootStackParamList> = {
  Home: 'ClientTabs',
  Profile: 'Profile',
  Orders: 'Orders',
  OrderDetails: 'OrderDetails',
  ProductDetails: 'ProductDetails',
  Promotions: 'Promotions',
  AllReviews: 'AllReviews',
  Checkout: 'Checkout',
  Payment: 'Payment',
  HabitualProducts: 'HabitualProducts',
  Returns: 'Returns',
  MyReturns: 'MyReturns',
  ReturnDetails: 'ReturnDetails',
  MyRefunds: 'MyRefunds',
  ProductRequests: 'ProductRequests',
  Messages: 'Messages',
  CustomerMessages: 'CustomerMessages',
  AdminLogin: 'AdminLogin',
  AdminDashboard: 'AdminDashboard',
  DelivererLogin: 'DelivererLogin',
  DelivererDashboard: 'DelivererDashboard',
  DelivererOrderDetails: 'DelivererOrderDetails',
};

/**
 * Équivalent mobile de `createPageUrl` du web. Utile pour migrer rapidement les
 * appels existants. Renvoie le nom de route React Navigation correspondant.
 */
export const pageToRoute = (pageName: string): keyof RootStackParamList | null =>
  PAGE_TO_ROUTE[pageName] ?? null;
