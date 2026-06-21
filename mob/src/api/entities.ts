/**
 * Façade Base44 entities & integrations pour le mobile.
 *
 * On expose des fonctions qui lisent l'instance courante du client (afin
 * qu'elles bénéficient automatiquement du token rafraîchi après login).
 * L'API surface est identique à src/api/entities.js + src/api/integrations.js
 * du projet web.
 */

import { getBase44 } from './base44Client';

export const entities = () => getBase44().entities;
export const integrations = () => getBase44().integrations;
export const functions = () => getBase44().functions;
export const auth = () => getBase44().auth;

// Raccourcis pour les entités les plus utilisées (cf. audit)
export const Product = () => entities().Product;
export const Order = () => entities().Order;
export const CartItem = () => entities().CartItem;
export const Review = () => entities().Review;
export const Return = () => entities().Return;
export const Refund = () => entities().Refund;
export const Message = () => entities().Message;
export const Visitor = () => entities().Visitor;
export const AppSettings = () => entities().AppSettings;
export const PromoCode = () => entities().PromoCode;
export const DiscountCode = () => entities().DiscountCode;
export const DiscountCodeUsage = () => entities().DiscountCodeUsage;
export const DiscountCodeSettings = () => entities().DiscountCodeSettings;
export const ReferralSettings = () => entities().ReferralSettings;
export const DeliveryZone = () => entities().DeliveryZone;
export const DeliverySlot = () => entities().DeliverySlot;
export const Deliverer = () => entities().Deliverer;
export const CashCollection = () => entities().CashCollection;
export const LoyaltySettings = () => entities().LoyaltySettings;
export const LoyaltyPoints = () => entities().LoyaltyPoints;
export const FreeProductClaim = () => entities().FreeProductClaim;
export const TierBenefit = () => entities().TierBenefit;
export const WelcomeMessage = () => entities().WelcomeMessage;
export const AdminPermissions = () => entities().AdminPermissions;
export const NotificationSettings = () => entities().NotificationSettings;
export const NotificationTemplate = () => entities().NotificationTemplate;
export const ProductRequest = () => entities().ProductRequest;
export const ProductRequestSettings = () => entities().ProductRequestSettings;
export const RevenueHistory = () => entities().RevenueHistory;
export const PrivacyPolicy = () => entities().PrivacyPolicy;
export const InternalRegulations = () => entities().InternalRegulations;
export const WalletTransaction = () => entities().WalletTransaction;
export const User = () => auth();

// Cloud functions (cf. dossier base44/functions/)
export type Base44FunctionName =
  | 'createPaymentIntent'
  | 'saveCard'
  | 'deleteCard'
  | 'updateStockAfterOrder'
  | 'restoreStockAfterCancellation'
  | 'notifyAdminsNewOrder'
  | 'sendOrderNotification'
  | 'sendOrderStatusEmail'
  | 'sendNotDeliveredNotification'
  | 'sendCustomInvitation'
  | 'handleCustomAuth'
  | 'addLoyaltyPointsOnDelivery'
  | 'removeLoyaltyPointsOnCancellation'
  | 'removeLoyaltyPointsOnReturn'
  | 'calculateLoyaltyPoints'
  | 'resetExpiredPoints'
  | 'archiveDailyCash'
  | 'archiveMonthlyRevenue'
  | 'processCardRefund'
  | 'testStripeConnection'
  | 'webhookStripe';

export const invokeFunction = async <T = unknown>(
  name: Base44FunctionName,
  payload?: Record<string, unknown>,
): Promise<T> => {
  const fn = (functions() as unknown as Record<string, (p?: unknown) => Promise<T>>)[name];
  if (!fn) {
    throw new Error(`Base44 function "${name}" introuvable.`);
  }
  return fn(payload);
};

// Intégrations Core (mêmes signatures que côté web ; SendSMS n'est pas exposé
// par le SDK — passer par une cloud function dédiée si besoin).
export const Core = () => integrations().Core;
export const InvokeLLM = (...args: Parameters<ReturnType<typeof Core>['InvokeLLM']>) =>
  Core().InvokeLLM(...args);
export const SendEmail = (...args: Parameters<ReturnType<typeof Core>['SendEmail']>) =>
  Core().SendEmail(...args);
export const UploadFile = (...args: Parameters<ReturnType<typeof Core>['UploadFile']>) =>
  Core().UploadFile(...args);
export const ExtractDataFromUploadedFile = (
  ...args: Parameters<ReturnType<typeof Core>['ExtractDataFromUploadedFile']>
) => Core().ExtractDataFromUploadedFile(...args);
