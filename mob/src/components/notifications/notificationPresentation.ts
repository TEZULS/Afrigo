import {
  Banknote,
  Bell,
  MessageSquare,
  Package,
  PackageCheck,
  PackageX,
  RotateCcw,
  ShoppingCart,
  Sparkles,
  Tag,
  Truck,
} from 'lucide-react-native';
import { palette } from '@/theme/tokens';
import { formatDateTime, formatRelative } from '@/utils/format';
import { parseServerDate } from '@/utils/serverDate';
import type { NotificationItem } from '@/hooks/useNotificationsFeed';
import type { IconComponent } from '@/types/icon';

const SEVEN_DAYS_MS = 7 * 24 * 36e5;

/** « il y a 2 heures » pour la semaine écoulée, sinon la date complète. */
export const notificationDateLabel = (iso?: string | null, now = Date.now()): string => {
  if (!iso) return '';
  const ms = parseServerDate(iso).getTime();
  if (!Number.isFinite(ms)) return '';
  if (now - ms < SEVEN_DAYS_MS && ms <= now) return formatRelative(iso);
  return formatDateTime(iso);
};

export interface NotificationVisual {
  Icon: IconComponent;
  /** Couleur de l'icône. */
  color: string;
  /** Fond de la pastille d'icône. */
  bg: string;
  /** Libellé de catégorie affiché au-dessus du titre. */
  label: string;
}

const ORDER_DONE = new Set(['delivered']);
const ORDER_FAILED = new Set(['cancelled', 'not_delivered', 'failed_delivery']);
const ORDER_MOVING = new Set(['shipped', 'out_for_delivery']);

/**
 * Icône, couleurs et catégorie d'une notification selon sa nature — et,
 * pour une commande, selon son statut (livrée, annulée, en route…).
 */
export const notificationVisual = (
  item: Pick<NotificationItem, 'kind' | 'orderStatus' | 'returnStatus'>,
): NotificationVisual => {
  switch (item.kind) {
    case 'order': {
      const status = item.orderStatus ?? '';
      if (ORDER_DONE.has(status)) {
        return { Icon: PackageCheck, color: palette.emerald[600], bg: palette.emerald[50], label: 'Commande livrée' };
      }
      if (ORDER_FAILED.has(status)) {
        return { Icon: PackageX, color: palette.rose[600], bg: palette.rose[50], label: 'Commande' };
      }
      if (ORDER_MOVING.has(status)) {
        return { Icon: Truck, color: palette.blue[600], bg: palette.blue[50], label: 'Livraison en cours' };
      }
      return { Icon: Package, color: palette.orange[600], bg: palette.orange[50], label: 'Commande' };
    }
    case 'message':
      return { Icon: MessageSquare, color: palette.blue[600], bg: palette.blue[50], label: 'Service client' };
    case 'product':
      return { Icon: Sparkles, color: palette.purple[600], bg: palette.purple[50], label: 'Nouveauté' };
    case 'promotion':
      return { Icon: Tag, color: palette.rose[600], bg: palette.rose[50], label: 'Promotion' };
    case 'cart':
      return { Icon: ShoppingCart, color: palette.emerald[600], bg: palette.emerald[50], label: 'Votre panier' };
    case 'return': {
      const status = item.returnStatus ?? 'pending';
      if (status === 'rejected') {
        return { Icon: RotateCcw, color: palette.rose[600], bg: palette.rose[50], label: 'Retour refusé' };
      }
      if (status === 'approved' || status === 'completed') {
        return { Icon: RotateCcw, color: palette.emerald[600], bg: palette.emerald[50], label: status === 'completed' ? 'Retour terminé' : 'Retour accepté' };
      }
      return { Icon: RotateCcw, color: palette.orange[600], bg: palette.orange[50], label: 'Demande de retour' };
    }
    case 'refund':
      return { Icon: Banknote, color: palette.emerald[600], bg: palette.emerald[50], label: 'Remboursement' };
    default:
      return { Icon: Bell, color: palette.orange[600], bg: palette.orange[50], label: 'AfriGo' };
  }
};
