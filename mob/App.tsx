import './global.css';
import React, { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { StripeProvider } from '@stripe/stripe-react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/lib/AuthContext';
import { queryClient, wireReactQueryToAppLifecycle } from '@/lib/query-client';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PushNotificationsBridge } from '@/components/PushNotificationsBridge';
import { env } from '@/config/env';
import { configureGoogleSignIn } from '@/services/socialAuth';
import { configureNotificationHandler } from '@/services/pushNotifications';
import { ToastHost } from '@/components/ui/ToastHost';

SplashScreen.preventAutoHideAsync().catch(() => {
  /* noop */
});

wireReactQueryToAppLifecycle();

const stripePublishableKey = env.stripe.publishableKey.trim();
// Une vraie clé Stripe fait ~107 chars. On rejette les placeholders type `pk_test_xxx`
// qui font planter le SDK natif à l'init côté Android.
const stripeNativeReady =
  (stripePublishableKey.startsWith('pk_test_') || stripePublishableKey.startsWith('pk_live_')) &&
  stripePublishableKey.length >= 30;

export default function App() {
  useEffect(() => {
    configureGoogleSignIn();
    // Doit être posé avant toute réception de push (y compris au démarrage à froid).
    configureNotificationHandler();

    let cancelled = false;
    InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (!cancelled) SplashScreen.hideAsync().catch(() => {});
      });
    });

    // OTA updates (équivalent du UpdatePrompt PWA web)
    if (!__DEV__) {
      Updates.checkForUpdateAsync()
        .then(async (res) => {
          if (res.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
          }
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const appBody = (
    <AuthProvider>
      <PushNotificationsBridge />
      <RootNavigator />
      {/*
        Hôte de notifications maison : il est démonté dès l'expiration du
        minuteur (cf. `useToast`), là où un bandeau dont la visibilité dépend
        d'une animation pouvait rester collé en haut de l'écran.
      */}
      <ToastHost />
    </AuthProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <ThemeProvider defaultMode="light">
            <QueryClientProvider client={queryClient}>
              {stripeNativeReady ? (
                <StripeProvider
                  publishableKey={stripePublishableKey}
                  merchantIdentifier={env.stripe.merchantId}
                  urlScheme="afrigo"
                >
                  {appBody}
                </StripeProvider>
              ) : (
                appBody
              )}
            </QueryClientProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
