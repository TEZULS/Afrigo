/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdminBroadcast from './pages/AdminBroadcast';
import AdminCarts from './pages/AdminCarts';
import AdminCustomerHistory from './pages/AdminCustomerHistory';
import AdminDashboard from './pages/AdminDashboard';
import AdminDelivererPreview from './pages/AdminDelivererPreview';
import AdminDelivererTracking from './pages/AdminDelivererTracking';
import AdminDeliverers from './pages/AdminDeliverers';
import AdminDeliverySlots from './pages/AdminDeliverySlots';
import AdminDeliveryZones from './pages/AdminDeliveryZones';
import AdminInviteUser from './pages/AdminInviteUser';
import AdminLogin from './pages/AdminLogin';
import AdminLoyalty from './pages/AdminLoyalty';
import AdminManagement from './pages/AdminManagement';
import AdminManualAssignment from './pages/AdminManualAssignment';
import AdminMessages from './pages/AdminMessages';
import AdminNotificationTemplates from './pages/AdminNotificationTemplates';
import AdminNotifications from './pages/AdminNotifications';
import AdminOrders from './pages/AdminOrders';
import AdminPayment from './pages/AdminPayment';
import AdminProductRequests from './pages/AdminProductRequests';
import AdminProducts from './pages/AdminProducts';
import AdminPromoCodes from './pages/AdminPromoCodes';
import AdminQRCode from './pages/AdminQRCode';
import AdminReferralSettings from './pages/AdminReferralSettings';
import AdminReferrals from './pages/AdminReferrals';
import AdminReturns from './pages/AdminReturns';
import AdminRevenueHistory from './pages/AdminRevenueHistory';
import AdminReviews from './pages/AdminReviews';
import AdminSettings from './pages/AdminSettings';
import AdminTiers from './pages/AdminTiers';
import AdminTopCustomers from './pages/AdminTopCustomers';
import AdminUsers from './pages/AdminUsers';
import AdminVisitors from './pages/AdminVisitors';
import AdminWallet from './pages/AdminWallet';
import AdminWalletHistory from './pages/AdminWalletHistory';
import AdminWelcomeMessage from './pages/AdminWelcomeMessage';
import AllReviews from './pages/AllReviews';
import Checkout from './pages/Checkout';
import DelivererDashboard from './pages/DelivererDashboard';
import DelivererLogin from './pages/DelivererLogin';
import DelivererOrderDetails from './pages/DelivererOrderDetails';
import HabitualProducts from './pages/HabitualProducts';
import Home from './pages/Home';
import Messages from './pages/Messages';
import MyRefunds from './pages/MyRefunds';
import MyReturns from './pages/MyReturns';
import OrderDetails from './pages/OrderDetails';
import Orders from './pages/Orders';
import Payment from './pages/Payment';
import ProductDetails from './pages/ProductDetails';
import ProductRequests from './pages/ProductRequests';
import Profile from './pages/Profile';
import Promotions from './pages/Promotions';
import Recipes from './pages/Recipes';
import ReturnDetails from './pages/ReturnDetails';
import Returns from './pages/Returns';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminBroadcast": AdminBroadcast,
    "AdminCarts": AdminCarts,
    "AdminCustomerHistory": AdminCustomerHistory,
    "AdminDashboard": AdminDashboard,
    "AdminDelivererPreview": AdminDelivererPreview,
    "AdminDelivererTracking": AdminDelivererTracking,
    "AdminDeliverers": AdminDeliverers,
    "AdminDeliverySlots": AdminDeliverySlots,
    "AdminDeliveryZones": AdminDeliveryZones,
    "AdminInviteUser": AdminInviteUser,
    "AdminLogin": AdminLogin,
    "AdminLoyalty": AdminLoyalty,
    "AdminManagement": AdminManagement,
    "AdminManualAssignment": AdminManualAssignment,
    "AdminMessages": AdminMessages,
    "AdminNotificationTemplates": AdminNotificationTemplates,
    "AdminNotifications": AdminNotifications,
    "AdminOrders": AdminOrders,
    "AdminPayment": AdminPayment,
    "AdminProductRequests": AdminProductRequests,
    "AdminProducts": AdminProducts,
    "AdminPromoCodes": AdminPromoCodes,
    "AdminQRCode": AdminQRCode,
    "AdminReferralSettings": AdminReferralSettings,
    "AdminReferrals": AdminReferrals,
    "AdminReturns": AdminReturns,
    "AdminRevenueHistory": AdminRevenueHistory,
    "AdminReviews": AdminReviews,
    "AdminSettings": AdminSettings,
    "AdminTiers": AdminTiers,
    "AdminTopCustomers": AdminTopCustomers,
    "AdminUsers": AdminUsers,
    "AdminVisitors": AdminVisitors,
    "AdminWallet": AdminWallet,
    "AdminWalletHistory": AdminWalletHistory,
    "AdminWelcomeMessage": AdminWelcomeMessage,
    "AllReviews": AllReviews,
    "Checkout": Checkout,
    "DelivererDashboard": DelivererDashboard,
    "DelivererLogin": DelivererLogin,
    "DelivererOrderDetails": DelivererOrderDetails,
    "HabitualProducts": HabitualProducts,
    "Home": Home,
    "Messages": Messages,
    "MyRefunds": MyRefunds,
    "MyReturns": MyReturns,
    "OrderDetails": OrderDetails,
    "Orders": Orders,
    "Payment": Payment,
    "ProductDetails": ProductDetails,
    "ProductRequests": ProductRequests,
    "Profile": Profile,
    "Promotions": Promotions,
    "Recipes": Recipes,
    "ReturnDetails": ReturnDetails,
    "Returns": Returns,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};