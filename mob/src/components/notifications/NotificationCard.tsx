import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Pressable } from '@/components/ui/Pressable';
import { ChevronRight, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import type { NotificationItem } from '@/hooks/useNotificationsFeed';
import { notificationDateLabel, notificationVisual } from './notificationPresentation';
import { NotificationImage } from './NotificationImage';

interface Props {
  item: NotificationItem;
  onPress: () => void;
  onDelete: () => void;
}

const ctaLabel = (item: NotificationItem): string => {
  switch (item.kind) {
    case 'order':
      return 'Voir la commande';
    case 'message':
      return 'Lire la réponse';
    case 'product':
      return 'Voir le produit';
    case 'promotion':
      return 'Voir les promotions';
    case 'cart':
      return 'Voir mon panier';
    case 'return':
      return 'Voir ma demande de retour';
    case 'refund':
      return 'Voir mes remboursements';
    default:
      return 'Voir le détail';
  }
};

/**
 * Une notification = une carte (même esprit que les cartes produit) : bandeau
 * icône + catégorie + date, titre, message, illustration, puis un pied avec
 * le bouton d'action et la corbeille. Les cartes sont séparées par une marge
 * et une ombre, sur un fond gris clair, pour ne plus se confondre entre elles.
 *
 * Les dimensions sont explicites (largeur de la colonne icône, marges) plutôt
 * que confiées à `gap`, pour un rendu identique sur toutes les versions
 * d'Android / iOS.
 */
export const NotificationCard: React.FC<Props> = ({ item, onPress, onDelete }) => {
  const { colors } = useTheme();
  const visual = notificationVisual(item);
  const unread = item.unread;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Non lue. ' : 'Lue. '}${visual.label}. ${item.title} — ${item.body}`}
      accessibilityHint="Ouvre le détail de la notification"
      testID={`notification-row-${item.id}`}
      onPress={onPress}
      onLongPress={onDelete}
      android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? colors.surfaceMuted : colors.card,
          borderColor: unread ? palette.orange[300] : colors.border,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: unread ? visual.bg : colors.muted }]}>
          <visual.Icon size={20} color={unread ? visual.color : colors.mutedForeground} />
        </View>

        <View style={styles.textCol}>
          <View style={styles.headRow}>
            <Text
              style={[styles.kind, { color: unread ? visual.color : colors.mutedForeground }]}
              numberOfLines={1}
            >
              {visual.label.toUpperCase()}
            </Text>
            {item.date ? (
              <Text style={[styles.date, { color: colors.mutedForeground }]} numberOfLines={1}>
                {notificationDateLabel(item.date)}
              </Text>
            ) : null}
          </View>

          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: unread ? colors.foreground : colors.mutedForeground, fontWeight: unread ? '800' : '700' },
              ]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {unread ? <View style={[styles.dot, { backgroundColor: palette.brand.orange }]} /> : null}
          </View>

          {item.body ? (
            <Text
              style={[styles.body, { color: unread ? colors.foreground : colors.mutedForeground }]}
              numberOfLines={3}
            >
              {item.body}
            </Text>
          ) : null}

          {item.imageUrl ? <NotificationImage uri={item.imageUrl} style={styles.image} /> : null}
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={[styles.cta, { backgroundColor: unread ? palette.brand.orange : palette.orange[50] }]}>
          <Text style={[styles.ctaText, { color: unread ? '#FFFFFF' : palette.orange[700] }]}>
            {ctaLabel(item)}
          </Text>
          <ChevronRight size={15} color={unread ? '#FFFFFF' : palette.orange[700]} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Supprimer la notification ${item.title}`}
          testID={`notification-delete-${item.id}`}
          onPress={(e) => {
            e?.stopPropagation?.();
            onDelete();
          }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.deleteBtn,
            { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.5 : 1 },
          ]}
        >
          <Trash2 size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textCol: { flex: 1, minWidth: 0 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, flexShrink: 1, marginRight: 8 },
  date: { fontSize: 11, flexShrink: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  title: { fontSize: 15, lineHeight: 20, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  body: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  image: { marginTop: 10 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: 18,
  },
  ctaText: { fontSize: 13, fontWeight: '700', marginRight: 2 },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
