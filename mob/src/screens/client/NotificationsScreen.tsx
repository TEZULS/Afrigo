import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, Pressable, RefreshControl, Alert, BackHandler, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, CheckCheck, ListChecks, Trash2 } from 'lucide-react-native';
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
  const {
    items,
    isLoading,
    isRefreshing,
    refresh,
    markRead,
    markAllRead,
    markSeen,
    remove,
    removeMany,
    unreadCount,
  } = useNotificationsFeed();
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  // Dans les onglets, la barre d'onglets couvre déjà le bas de l'écran.
  const tabBarHeight = React.useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  const bottomInset = tabBarHeight === undefined ? insets.bottom : 0;

  /*
   * Sélection multiple (demande du 2026-10-20) : appui long sur une
   * notification ou bouton « Sélectionner », puis on coche celles à supprimer.
   */
  const [selecting, setSelecting] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const visibleIds = useMemo(() => items.map((i) => i.id), [items]);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => checked.has(id));

  const startSelection = useCallback((id?: string) => {
    setSelecting(true);
    setChecked(new Set(id ? [id] : []));
  }, []);
  const stopSelection = useCallback(() => {
    setSelecting(false);
    setChecked(new Set());
  }, []);
  const toggleChecked = useCallback((id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Une notification qui disparaît du fil n'est plus cochée.
  useEffect(() => {
    setChecked((prev) => {
      const kept = [...prev].filter((id) => visibleIds.includes(id));
      return kept.length === prev.size ? prev : new Set(kept);
    });
  }, [visibleIds]);

  // Bouton retour d'Android : quitte la sélection au lieu de l'écran.
  useFocusEffect(
    useCallback(() => {
      if (!selecting) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        stopSelection();
        return true;
      });
      return () => sub.remove();
    }, [selecting, stopSelection]),
  );

  const confirmDeleteChecked = () => {
    const ids = [...checked];
    if (ids.length === 0) return;
    Alert.alert(
      ids.length === 1 ? 'Supprimer cette notification ?' : `Supprimer ces ${ids.length} notifications ?`,
      undefined,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            removeMany(ids);
            stopSelection();
          },
        },
      ],
    );
  };

  /**
   * Ouvrir l'écran remet la bulle de la cloche à zéro, sans rien marquer comme
   * lu : chaque notification reste surlignée tant qu'elle n'a pas été ouverte.
   * `markSeen` change quand une notification plus récente arrive : l'effet se
   * relance alors, et la bulle reste à zéro tant que l'écran est affiché.
   */
  useFocusEffect(
    useCallback(() => {
      markSeen();
    }, [markSeen]),
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
    if (item.kind === 'refund') {
      nav.navigate('MyRefunds');
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
    <NotificationCard
      item={item}
      selectionMode={selecting}
      selected={checked.has(item.id)}
      onPress={() => (selecting ? toggleChecked(item.id) : openItem(item))}
      onLongPress={() => (selecting ? toggleChecked(item.id) : startSelection(item.id))}
      onDelete={() => confirmDelete(item)}
    />
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
          !isAuthenticated ? null : selecting ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annuler la sélection"
              onPress={stopSelection}
              hitSlop={10}
              style={styles.headerTextBtn}
              testID="notifications-selection-cancel"
            >
              <Text style={[styles.headerText, { color: colors.brandOrange }]}>Annuler</Text>
            </Pressable>
          ) : (
            <View style={styles.headerActions}>
              {items.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sélectionner des notifications"
                  onPress={() => startSelection()}
                  hitSlop={10}
                  style={styles.headerBtn}
                  android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: true, radius: 20 }}
                  testID="notifications-select"
                >
                  <ListChecks size={20} color={colors.brandOrange} />
                </Pressable>
              ) : null}
              {unreadCount > 0 ? (
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
              ) : null}
            </View>
          )
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

      {selecting ? (
        <View
          style={[
            styles.selectionBar,
            { borderTopColor: colors.border, backgroundColor: colors.card, paddingBottom: 12 + bottomInset },
          ]}
          testID="notifications-selection-bar"
        >
          <Button
            title={allChecked ? 'Tout désélectionner' : 'Tout sélectionner'}
            variant="outline"
            onPress={() => setChecked(allChecked ? new Set() : new Set(visibleIds))}
            style={{ flex: 1 }}
            testID="notifications-select-all"
          />
          <Button
            title={checked.size > 0 ? `Supprimer (${checked.size})` : 'Supprimer'}
            variant="destructive"
            disabled={checked.size === 0}
            leftIcon={<Trash2 size={16} color="#FFFFFF" />}
            onPress={confirmDeleteChecked}
            style={{ flex: 1 }}
            testID="notifications-delete-selected"
          />
        </View>
      ) : null}

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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTextBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  headerText: { fontSize: 15, fontWeight: '700' },
  selectionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
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
