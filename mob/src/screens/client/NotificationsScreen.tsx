import React, { useCallback, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, CheckCheck } from 'lucide-react-native';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotificationDetailSheet } from '@/components/notifications/NotificationDetailSheet';
import { NotificationCard } from '@/components/notifications/NotificationCard';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { useNotificationsFeed, type NotificationItem } from '@/hooks/useNotificationsFeed';
import type { RootStackParamList } from '@/navigation/types';

export const NotificationsScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const { items, isLoading, isRefreshing, refresh, markRead, markAllRead, remove, unreadCount } =
    useNotificationsFeed();
  const [selected, setSelected] = useState<NotificationItem | null>(null);

  /**
   * Quitter l'écran vaut « tout vu » : le badge de la cloche retombe à zéro
   * même si l'utilisateur n'a pas ouvert chaque notification. Tant qu'il est
   * sur l'écran, les non-lues restent surlignées pour qu'il les repère.
   * `markAllRead` est lu via une ref : le nettoyage de `useFocusEffect` ne
   * doit pas se réabonner à chaque rafraîchissement du fil.
   */
  const markAllReadRef = useRef(markAllRead);
  markAllReadRef.current = markAllRead;
  useFocusEffect(
    useCallback(
      () => () => {
        markAllReadRef.current();
      },
      [],
    ),
  );

  /** Appui sur une ligne : lecture du texte complet dans la feuille de détail. */
  const openItem = (item: NotificationItem) => {
    markRead(item.id);
    setSelected(item);
  };

  const openTarget = () => {
    const item = selected;
    setSelected(null);
    if (!item) return;
    if (item.kind === 'order' && item.orderId) {
      nav.navigate('OrderDetails', { id: item.orderId });
      return;
    }
    if (item.kind === 'product' && item.productId) {
      nav.navigate('ProductDetails', { id: item.productId });
      return;
    }
    if (item.kind === 'promotion') {
      nav.navigate('ClientTabs', { screen: 'PromotionsTab' });
      return;
    }
    if (item.kind === 'return' && item.returnId) {
      nav.navigate('ReturnDetails', { id: item.returnId });
      return;
    }
    if (item.kind === 'cart') {
      nav.navigate('ClientTabs', { screen: 'CartTab' });
      return;
    }
    if (item.kind === 'message') nav.navigate('Messages');
  };

  const confirmDelete = (item: NotificationItem) => {
    Alert.alert('Supprimer cette notification ?', item.title, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          remove(item.id);
          setSelected((cur) => (cur?.id === item.id ? null : cur));
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <NotificationCard item={item} onPress={() => openItem(item)} onDelete={() => confirmDelete(item)} />
  );

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <StatusBar style="dark" />
      <Header
        title="Notifications"
        right={
          isAuthenticated && unreadCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tout marquer comme lu"
              onPress={markAllRead}
              hitSlop={10}
              style={styles.headerBtn}
              android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true, radius: 20 }}
            >
              <CheckCheck size={20} color={colors.brandOrange} />
            </Pressable>
          ) : null
        }
      />

      {!isAuthenticated ? (
        <View style={styles.center}>
          <EmptyState
            title="Aucune notification"
            description="Connectez-vous pour suivre vos commandes et les réponses du service client."
          />
          <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
            <Button
              title="Se connecter"
              variant="brand"
              fullWidth
              onPress={() => nav.navigate('Login', { initialMode: 'login' })}
            />
          </View>
        </View>
      ) : isLoading ? (
        <Loader />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          style={{ backgroundColor: colors.surfaceMuted }}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              tintColor={colors.brandOrange}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                <Bell size={24} color={colors.mutedForeground} />
              </View>
              <EmptyState
                title="Aucune notification"
                description="Le suivi de vos commandes et les réponses du service client apparaîtront ici."
              />
            </View>
          }
        />
      )}

      <NotificationDetailSheet
        item={selected}
        onClose={() => setSelected(null)}
        onOpenTarget={openTarget}
        onDelete={() => selected && confirmDelete(selected)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
});
