import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * Deep linking AfriGo :
 *   - schéma `afrigo://...` (préféré pour le retour OAuth)
 *   - https://afrigo.app/* (universal links iOS / app links Android)
 *
 * Couvre les pages clients principales pour permettre des partages produits,
 * notifications push profondes et rebranchement OAuth.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'afrigo://', 'https://afrigo.app'],
  config: {
    screens: {
      ClientTabs: {
        screens: {
          HomeTab: '',
          OrdersTab: 'commandes',
          CartTab: 'panier',
          MenuTab: 'menu',
          ProfileTab: 'profil',
        },
      },
      ProductDetails: 'produit/:id',
      Checkout: 'commande/checkout',
      Payment: 'commande/paiement',
      Orders: 'commandes',
      OrderDetails: 'commande/:id',
      Promotions: 'promotions',
      AllReviews: 'avis/:productId',
      HabitualProducts: 'mes-habitudes',
      Returns: 'retour/:orderId',
      MyReturns: 'mes-retours',
      ReturnDetails: 'retour/details/:id',
      MyRefunds: 'remboursements',
      ProductRequests: 'demandes-produits',
      Messages: 'messages',
      CustomerMessages: 'messages-client',
      Profile: 'profil',
      ProfileEdit: 'profil/modifier',
      Login: 'login',
      AdminLogin: 'admin/login',
      AdminDashboard: 'admin',
      DelivererLogin: 'livreur/login',
      DelivererDashboard: 'livreur',
      DelivererOrderDetails: 'livreur/commande/:id',
    },
  },
};
