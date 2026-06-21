import './global.css';
import React, { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { StripeProvider } from '@stripe/stripe-react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Updates from 'expo-updates';
import Toast from 'react-native-toast-message';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/lib/AuthContext';
import { queryClient, wireReactQueryToAppLifecycle } from '@/lib/query-client';
import { RootNavigator } from '@/navigation/RootNavigator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { env } from '@/config/env';

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
      <RootNavigator />
      <Toast />
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
