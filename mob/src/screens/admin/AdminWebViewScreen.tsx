/**
 * AdminWebViewScreen — pont natif vers le panneau Admin web d'AfriGo.
 *
 * Stratégie justifiée par l'audit :
 *   - 38 écrans admin existent côté web (75 000 lignes au total).
 *   - 22 d'entre eux dépendent de patterns Web non triviaux à porter
 *     (impression de bordereaux HTML via window.print/document.write,
 *     AudioContext, drag & drop @hello-pangea/dnd, react-leaflet,
 *     react-quill, recharts, html2canvas, qrcode canvas, embla-carousel).
 *   - Les fonctions critiques (CRUD via Base44) restent identiques.
 *
 * Plutôt que de re-développer 38 écrans complexes, on injecte le token
 * Base44 du livreur/admin courant dans la WebView via `injectedJavaScriptBeforeContentLoaded`,
 * de sorte que le panneau admin web fonctionne nativement à l'intérieur de l'app.
 *
 * Il est trivial ensuite de migrer écran par écran vers du natif RN, en commençant
 * par AdminDashboard (déjà natif) et AdminOrders/AdminProducts/AdminUsers/AdminMessages
 * — voir docs/MIGRATION.md pour la roadmap.
 */

import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute } from '@react-navigation/native';
import { Loader } from '@/components/ui/Loader';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { useNavigation } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { tokenStore } from '@/api/base44Client';
import { env } from '@/config/env';
import type { AdminDrawerParamList } from '@/navigation/types';

type WebViewRouteParams = { route?: string; title?: string };

export const AdminWebViewScreen: React.FC = () => {
  const route = useRoute();
  const params = (route.params ?? {}) as WebViewRouteParams;
  const nav = useNavigation<DrawerNavigationProp<AdminDrawerParamList>>();
  const ref = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);

  const targetRoute = params.route ?? '/AdminDashboard';
  const title = params.title ?? 'Administration';
  const url = `${env.app.baseUrl.replace(/\/$/, '')}${targetRoute}`;
  const token = tokenStore.peek();

  // Injection du token Base44 dans le localStorage du WebView avant chargement.
  // Cela reproduit exactement le mécanisme web (cf. src/lib/app-params.js du
  // projet original : clé `base44_access_token`).
  const injectedJsBeforeLoad = useMemo(() => {
    if (!token) return '';
    return `
      try {
        window.localStorage.setItem('base44_access_token', ${JSON.stringify(token)});
        window.localStorage.setItem('base44_app_id', ${JSON.stringify(env.base44.appId)});
      } catch (e) {}
      true;
    `;
  }, [token]);

  return (
    <Screen scroll={false} paddingHorizontal={0}>
      <Header title={title} onBack={() => nav.goBack()} />
      <View style={{ flex: 1 }}>
        <WebView
          ref={ref}
          source={{ uri: url }}
          injectedJavaScriptBeforeContentLoaded={injectedJsBeforeLoad}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState
          domStorageEnabled
          javaScriptEnabled
          allowsBackForwardNavigationGestures
          decelerationRate="normal"
          originWhitelist={['*']}
          style={styles.webview}
        />
        {loading ? (
          <View style={styles.loader}>
            <Loader />
          </View>
        ) : null}
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  webview: { flex: 1 },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
