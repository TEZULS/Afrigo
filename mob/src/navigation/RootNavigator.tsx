import React from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppSettings } from '@/hooks/useAppSettings';
import { Loader } from '@/components/ui/Loader';
import { MenuDrawer } from '@/components/menu/MenuDrawer';
import { MaintenanceScreen } from '@/screens/client/MaintenanceScreen';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { UserNotRegisteredScreen } from '@/screens/auth/UserNotRegisteredScreen';
import { ClientTabs } from './ClientTabs';
import { AdminDrawer } from './AdminDrawer';
import { DelivererStack } from './DelivererStack';
import { linking } from './linking';
import { navigationRef } from './navigationRef';
import type { RootStackParamList } from './types';

import { SearchScreen } from '@/screens/client/SearchScreen';
import { ProductDetailsScreen } from '@/screens/client/ProductDetailsScreen';
import { CheckoutScreen } from '@/screens/client/CheckoutScreen';
import { PaymentScreen } from '@/screens/client/PaymentScreen';
import { OrderDetailsScreen } from '@/screens/client/OrderDetailsScreen';
import { AllReviewsScreen } from '@/screens/client/AllReviewsScreen';
import { RecipesScreen } from '@/screens/client/RecipesScreen';
import { HabitualProductsScreen } from '@/screens/client/HabitualProductsScreen';
import { ReturnsScreen } from '@/screens/client/ReturnsScreen';
import { MyReturnsScreen } from '@/screens/client/MyReturnsScreen';
import { ReturnDetailsScreen } from '@/screens/client/ReturnDetailsScreen';
import { MyRefundsScreen } from '@/screens/client/MyRefundsScreen';
import { ProductRequestsScreen } from '@/screens/client/ProductRequestsScreen';
import { MessagesScreen } from '@/screens/client/MessagesScreen';
import { ContactScreen } from '@/screens/client/ContactScreen';
import { PaymentMethodsScreen } from '@/screens/client/PaymentMethodsScreen';
import { CustomerMessagesScreen } from '@/screens/client/CustomerMessagesScreen';
import { NotificationsScreen } from '@/screens/client/NotificationsScreen';
import { OrdersScreen } from '@/screens/client/OrdersScreen';
import { ProfileScreen } from '@/screens/client/ProfileScreen';
import { ProfileEditScreen } from '@/screens/client/ProfileEditScreen';
import { SettingsScreen } from '@/screens/client/SettingsScreen';
import { LegalScreen } from '@/screens/client/LegalScreen';
import { AdminLoginScreen } from '@/screens/admin/AdminLoginScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  const { scheme, colors } = useTheme();
  const settings = useAppSettings();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <Loader fullscreen />;
  }

  if (settings.data && settings.data.is_available === false) {
    return <MaintenanceScreen message={settings.data.maintenance_message} />;
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={{
        dark: scheme === 'dark',
        colors: {
          primary: colors.brandOrange,
          background: colors.background,
          card: colors.card,
          text: colors.foreground,
          border: colors.border,
          notification: colors.brandOrange,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '800' },
        },
      }}
    >
      <View style={{ flex: 1 }} pointerEvents="box-none">
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="ClientTabs" component={ClientTabs} />

        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ animation: 'fade' }}
        />

        <Stack.Group screenOptions={{ animation: 'slide_from_right' }}>
          <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
          <Stack.Screen name="Checkout" component={CheckoutScreen} />
          <Stack.Screen name="Payment" component={PaymentScreen} />
          <Stack.Screen name="Orders" component={OrdersScreen} />
          <Stack.Screen name="OrderDetails" component={OrderDetailsScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Legal" component={LegalScreen} />
          <Stack.Screen name="Recipes" component={RecipesScreen} />
          <Stack.Screen name="AllReviews" component={AllReviewsScreen} />
          <Stack.Screen name="HabitualProducts" component={HabitualProductsScreen} />
          <Stack.Screen name="Returns" component={ReturnsScreen} />
          <Stack.Screen name="MyReturns" component={MyReturnsScreen} />
          <Stack.Screen name="ReturnDetails" component={ReturnDetailsScreen} />
          <Stack.Screen name="MyRefunds" component={MyRefundsScreen} />
          <Stack.Screen name="ProductRequests" component={ProductRequestsScreen} />
          <Stack.Screen name="Contact" component={ContactScreen} />
          <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
          <Stack.Screen name="Messages" component={MessagesScreen} />
          <Stack.Screen name="CustomerMessages" component={CustomerMessagesScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </Stack.Group>

        <Stack.Group screenOptions={{ presentation: 'modal' }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="UserNotRegistered" component={UserNotRegisteredScreen} />
        </Stack.Group>

        <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
        <Stack.Screen
          name="AdminDrawer"
          component={AdminDrawer}
          options={{ animation: 'fade' }}
        />

        <Stack.Screen
          name="DelivererStack"
          component={DelivererStack}
          options={{ animation: 'fade' }}
        />
      </Stack.Navigator>
      {/*
        MenuDrawer rendu APRÈS le Stack.Navigator → z-index supérieur, donc
        s'affiche par-dessus n'importe quel écran (y compris ceux empilés
        au-dessus de ClientTabs comme Contact, MyRefunds, PaymentMethods…).
      */}
      <MenuDrawer />
      </View>
    </NavigationContainer>
  );
};
