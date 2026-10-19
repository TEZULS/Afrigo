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
import { parseServerDate } from '@/utils/serverDate';
import type { NotificationItem } from '@/hooks/useNotificationsFeed';
import type { IconComponent } from '@/types/icon';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 36e5;
const WEEKDAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
/** « 17h05 » (heure du téléphone). */
const clock = (d: Date) => `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * Date d'une notification, à la manière d'une messagerie (demande du
 * 2026-10-20) : « À l'instant », « Il y a 12 min », « Aujourd'hui à 17h05 »,
 * « Hier à 17h05 », « Lundi à 17h05 » sur la semaine, puis « 12 oct. à 17h05 »
 * (avec l'année si ce n'est pas l'année en cours).
 */
export const notificationDateLabel = (iso?: string | null, now = Date.now()): string => {
  if (!iso) return '';
  const d = parseServerDate(iso);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return '';
  const elapsed = now - ms;
  if (elapsed >= 0 && elapsed < MINUTE_MS) return "À l'instant";
  if (elapsed >= 0 && elapsed < 60 * MINUTE_MS) return `Il y a ${Math.floor(elapsed / MINUTE_MS)} min`;
  const today = new Date(now);
  // Arrondi : un jour de changement d'heure dure 23 ou 25 h.
  const days = Math.round((startOfDay(today) - startOfDay(d)) / DAY_MS);
  if (days <= 0) return `Aujourd'hui à ${clock(d)}`;
  if (days === 1) return `Hier à ${clock(d)}`;
  if (days < 7) return `${WEEKDAYS[d.getDay()]} à ${clock(d)}`;
  const year = d.getFullYear() === today.getFullYear() ? '' : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${year} à ${clock(d)}`;
};

/** Pour la fiche de détail : « Reçue hier à 17h05 », « Reçue le 12 oct. à 17h05 ». */
export const notificationReceivedLabel = (iso?: string | null, now = Date.now()): string => {
  const label = notificationDateLabel(iso, now);
  if (!label) return '';
  if (/^\d/.test(label)) return `Reçue le ${label}`;
  return `Reçue ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
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
