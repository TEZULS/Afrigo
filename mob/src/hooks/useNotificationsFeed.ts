/**
 * Flux de notifications client.
 *
 * Source principale : l'entité **`AppNotification`** du backend base44 — c'est
 * elle qu'alimentent l'admin (notifications `manual`), le suivi de livraison
 * (`delivery_status`) et les relances panier (`cart_reminder`). Une
 * notification cible soit tout le monde (`target_audience: 'all'`), soit une
 * liste d'e-mails (`target_emails`).
 *
 * S'y ajoutent deux sources dérivées, pour l'historique antérieur à
 * `AppNotification` : l'avancement des commandes et les réponses du service
 * client (`Message` avec `sender_type = 'admin'`).
 *
 * L'état « lu » vit dans **`NotificationRead`** (une ligne par notification et
 * par utilisateur), donc il suit le compte d'un appareil à l'autre. Un cache
 * local le double pour un affichage instantané et hors ligne. La suppression
 * par le client suit le même chemin (`NotificationRead.deleted`, comme le web).
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppNotification, Message, NotificationRead, Order } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { hydrateKvFromDisk, kv } from '@/services/storage';
import { serverDateMs } from '@/utils/serverDate';

/**
 * Nature de la notification — pilote l'icône, la couleur, le libellé de
 * catégorie et l'écran ouvert depuis le détail.
 */
export type NotificationKind = 'order' | 'message' | 'custom' | 'product' | 'promotion' | 'cart';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  date: string | null;
  /** Identifiant de commande pour la navigation (kind === 'order'). */
  orderId?: string;
  /** Statut de commande connu (items dérivés) — colore l'icône. */
  orderStatus?: string;
  /** Produit lié (kind === 'product'). */
  productId?: string;
  /** Illustration éventuelle (notifications admin). */
  imageUrl?: string;
  /**
   * `true` pour les items reconstruits depuis une commande ou un message —
   * les seuls que l'ancien fil affichait, donc les seuls concernés par le
   * plancher de migration `readBeforeMs`.
   */
  derived?: boolean;
  unread: boolean;
}

interface OrderRow {
  id: string;
  status?: string;
  created_date?: string;
  updated_date?: string;
}

interface MessageRow {
  id: string;
  content?: string;
  sender_type?: string;
  created_date?: string;
}

/** Cf. schéma base44 `AppNotification`. */
interface AppNotificationRow {
  id: string;
  title?: string;
  message?: string;
  image_url?: string | null;
  images?: string[];
  type?:
    | 'delivery_status'
    | 'new_product'
    | 'promotion_active'
    | 'promotion_ending'
    | 'manual'
    | 'order'
    | 'cart_reminder';
  target_audience?: 'all' | 'specific';
  target_emails?: string[];
  related_id?: string | null;
  related_type?: 'order' | 'product' | 'promotion' | 'none' | 'cart' | null;
  created_date?: string;
}

/** Cf. schéma base44 `NotificationRead`. */
interface NotificationReadRow {
  id: string;
  notification_id?: string;
  user_email?: string;
  is_read?: boolean;
  deleted?: boolean;
}

const STATUS_TEXT: Record<string, string> = {
  pending: 'Votre commande a bien été enregistrée.',
  confirmed: 'Votre commande est confirmée.',
  preparing: 'Votre commande est en préparation.',
  ready: 'Votre commande est prête.',
  shipped: 'Votre commande a été expédiée.',
  out_for_delivery: 'Votre commande est en cours de livraison.',
  delivered: 'Votre commande a été livrée.',
  cancelled: 'Votre commande a été annulée.',
  not_delivered: "Votre commande n'a pas pu être livrée.",
  failed_delivery: 'La livraison de votre commande a échoué.',
  returned: 'Votre retour a été enregistré.',
};

/** Nombre de notifications remontées par requête (les plus récentes d'abord). */
const REMOTE_LIMIT = 120;

/** Ancienne clé (horodatage global) — migrée une seule fois vers `READ_BEFORE_KEY`. */
const LEGACY_LAST_SEEN_KEY = 'notifications_last_seen_at';
/** Cache local des identifiants lus (doublon optimiste de `NotificationRead`). */
const READ_IDS_KEY = 'notifications_read_ids';
/** Tout ce qui est antérieur à cet horodatage est considéré comme lu. */
const READ_BEFORE_KEY = 'notifications_read_before_at';
/** Cache local des identifiants supprimés par le client (doublon de `NotificationRead.deleted`). */
const HIDDEN_IDS_KEY = 'notifications_hidden_ids';

/** Au-delà, on purge les identifiants les plus anciens (état borné sur le disque). */
const MAX_READ_IDS = 500;

// --- Store « état de lecture » (partagé par tous les consommateurs du hook) ---

const listeners = new Set<() => void>();
let version = 0;
let readIds: string[] = [];
let readIdSet = new Set<string>();
let readBeforeMs = 0;
let hiddenIds: string[] = [];
let hiddenIdSet = new Set<string>();

const emit = () => {
  version += 1;
  listeners.forEach((cb) => cb());
};

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

const getVersion = () => version;

const persistReadIds = (next: string[]) => {
  readIds = next.length > MAX_READ_IDS ? next.slice(next.length - MAX_READ_IDS) : next;
  readIdSet = new Set(readIds);
  kv.set(READ_IDS_KEY, readIds);
};

/** Ajoute des identifiants au cache local sans notifier si rien ne change. */
const mergeReadIds = (ids: string[]): boolean => {
  const added = ids.filter((id) => id && !readIdSet.has(id));
  if (added.length === 0) return false;
  persistReadIds([...readIds, ...added]);
  return true;
};

const persistHiddenIds = (next: string[]) => {
  hiddenIds = next.length > MAX_READ_IDS ? next.slice(next.length - MAX_READ_IDS) : next;
  hiddenIdSet = new Set(hiddenIds);
  kv.set(HIDDEN_IDS_KEY, hiddenIds);
};

const mergeHiddenIds = (ids: string[]): boolean => {
  const added = ids.filter((id) => id && !hiddenIdSet.has(id));
  if (added.length === 0) return false;
  persistHiddenIds([...hiddenIds, ...added]);
  return true;
};

/**
 * `kv` s'hydrate depuis AsyncStorage de façon asynchrone : on attend cette
 * hydratation avant de lire l'état, sinon le badge repartirait de zéro à
 * chaque démarrage.
 */
let hydration: Promise<void> | null = null;

const hydrateReadState = () => {
  if (hydration) return hydration;
  hydration = hydrateKvFromDisk()
    .then(() => {
      const storedIds = kv.get<string[]>(READ_IDS_KEY);
      readIds = Array.isArray(storedIds) ? storedIds.filter((v) => typeof v === 'string') : [];
      readIdSet = new Set(readIds);

      const storedHidden = kv.get<string[]>(HIDDEN_IDS_KEY);
      hiddenIds = Array.isArray(storedHidden)
        ? storedHidden.filter((v) => typeof v === 'string')
        : [];
      hiddenIdSet = new Set(hiddenIds);

      const storedBefore = Number(kv.get<string | number>(READ_BEFORE_KEY) ?? 0) || 0;
      if (storedBefore) {
        readBeforeMs = storedBefore;
      } else {
        // Migration depuis l'ancien fonctionnement : ce que l'utilisateur avait
        // déjà consulté reste lu, on ne lui ressort pas tout l'historique.
        const legacy = Number(kv.get<string | number>(LEGACY_LAST_SEEN_KEY) ?? 0) || 0;
        readBeforeMs = legacy;
        if (legacy) kv.set(READ_BEFORE_KEY, String(legacy));
      }
    })
    .catch(() => {
      /* état de lecture indisponible : on repart d'un état vide */
    })
    .finally(emit);
  return hydration;
};

void hydrateReadState();

const toMs = (iso?: string | null) => serverDateMs(iso);

const orderLabel = (id: string) => `#${id.slice(-8).toUpperCase()}`;

/**
 * Nature d'une `AppNotification` : l'entité liée prime, sinon le type saisi
 * par l'admin (`new_product`, `promotion_*`, `cart_reminder`).
 */
const remoteKind = (n: AppNotificationRow): NotificationKind => {
  switch (n.related_type) {
    case 'order':
      return 'order';
    case 'product':
      return 'product';
    case 'promotion':
      return 'promotion';
    case 'cart':
      return 'cart';
    default:
      break;
  }
  switch (n.type) {
    case 'delivery_status':
    case 'order':
      return n.related_id ? 'order' : 'custom';
    case 'new_product':
      return 'product';
    case 'promotion_active':
    case 'promotion_ending':
      return 'promotion';
    case 'cart_reminder':
      return 'cart';
    default:
      return 'custom';
  }
};

/**
 * Une `AppNotification` n'a jamais été affichée par les versions précédentes de
 * l'app : elle ne peut donc pas avoir été « déjà vue », et le plancher de
 * migration ne s'y applique pas. Seules les lignes dérivées (commandes,
 * messages) en héritent.
 */
const isUnread = (item: { id: string; date: string | null; derived?: boolean }) => {
  if (readIdSet.has(item.id)) return false;
  if (item.derived) return toMs(item.date) > readBeforeMs;
  return true;
};

// --- Persistance serveur de l'état « lu » -----------------------------------

type NotificationReadApi = {
  filter?: (q: unknown, sort?: string, limit?: number) => Promise<NotificationReadRow[]>;
  create?: (data: unknown) => Promise<NotificationReadRow>;
  update?: (id: string, data: unknown) => Promise<unknown>;
};

/**
 * Écrit (ou met à jour) la ligne `NotificationRead` correspondante. L'échec est
 * volontairement silencieux : le cache local a déjà mis l'UI à jour, et la
 * prochaine ouverture retentera.
 */
const persistReadOnServer = async (userEmail: string, notificationIds: string[]) => {
  if (!userEmail || notificationIds.length === 0) return;
  const api = NotificationRead() as unknown as NotificationReadApi;
  if (typeof api?.create !== 'function') return;

  for (const notificationId of notificationIds) {
    try {
      const existing =
        (await api.filter?.({ user_email: userEmail, notification_id: notificationId })) ?? [];
      if (existing.length > 0) {
        if (!existing[0].is_read && typeof api.update === 'function') {
          await api.update(existing[0].id, { is_read: true, read_date: new Date().toISOString() });
        }
        continue;
      }
      await api.create({
        notification_id: notificationId,
        user_email: userEmail,
        is_read: true,
        read_date: new Date().toISOString(),
        deleted: false,
      });
    } catch {
      /* hors ligne / droits : le cache local fait foi jusqu'au prochain essai */
    }
  }
};

/**
 * Suppression côté serveur : `NotificationRead.deleted = true` — même mécanique
 * que le web déployé, la ligne `AppNotification` (partagée) n'est jamais
 * touchée. Une notification supprimée est aussi considérée lue.
 */
const persistDeleteOnServer = async (userEmail: string, notificationId: string) => {
  if (!userEmail || !notificationId) return;
  const api = NotificationRead() as unknown as NotificationReadApi;
  if (typeof api?.create !== 'function') return;
  try {
    const existing =
      (await api.filter?.({ user_email: userEmail, notification_id: notificationId })) ?? [];
    if (existing.length > 0) {
      if (typeof api.update === 'function') {
        await api.update(existing[0].id, { deleted: true, is_read: true });
      }
      return;
    }
    await api.create({
      notification_id: notificationId,
      user_email: userEmail,
      is_read: true,
      read_date: new Date().toISOString(),
      deleted: true,
    });
  } catch {
    /* hors ligne / droits : le cache local masque déjà la ligne */
  }
};

/** E-mail du compte courant — nécessaire aux écritures `NotificationRead`. */
let currentEmail: string | null = null;

/**
 * Vide le cache local de lecture. Appelé au changement de compte : l'état
 * « lu » d'un client ne doit pas fuir sur le suivant. Le serveur
 * (`NotificationRead`) reste la source de vérité et réhydrate le cache.
 */
export const resetNotificationsReadCache = () => {
  persistReadIds([]);
  persistHiddenIds([]);
  readBeforeMs = 0;
  kv.remove(READ_BEFORE_KEY);
  emit();
};

/** Supprime une notification du fil de ce client (masquée, jamais effacée du serveur). */
export const deleteNotification = (id: string) => {
  if (!id) return;
  mergeReadIds([id]);
  if (mergeHiddenIds([id])) emit();
  if (currentEmail) void persistDeleteOnServer(currentEmail, id);
};

/** Marque une notification précise comme lue (appui sur la ligne). */
export const markNotificationRead = (id: string) => {
  if (!id || !mergeReadIds([id])) return;
  emit();
  if (currentEmail) void persistReadOnServer(currentEmail, [id]);
};

/** « Tout marquer comme lu » : le badge retombe à 0. */
export const markAllNotificationsRead = (ids: string[] = []) => {
  const toPersist = ids.filter((id) => !readIdSet.has(id));
  // Le plancher couvre les lignes dérivées (commandes / messages) ; les
  // `AppNotification` doivent être listées explicitement.
  readBeforeMs = Date.now();
  kv.set(READ_BEFORE_KEY, String(readBeforeMs));
  mergeReadIds(ids);
  emit();
  if (currentEmail && toPersist.length) void persistReadOnServer(currentEmail, toPersist);
};

// --- Lecture des sources ----------------------------------------------------

const safe = async <T>(fn: () => Promise<T[] | undefined> | undefined): Promise<T[]> => {
  try {
    return (await fn()) ?? [];
  } catch {
    return [];
  }
};

type EntityApi<T> = {
  filter?: (q: unknown, sort?: string, limit?: number) => Promise<T[]>;
};

const fetchAppNotifications = async (email: string): Promise<AppNotificationRow[]> => {
  const api = AppNotification() as unknown as EntityApi<AppNotificationRow>;
  if (typeof api?.filter !== 'function') return [];

  // Base44 ne sait pas exprimer un OU : on fait deux requêtes puis on fusionne.
  // `target_emails` est un tableau — le filtre se comporte en « contient ».
  const [mine, broadcast] = await Promise.all([
    safe(() => api.filter!({ target_emails: email }, '-created_date', REMOTE_LIMIT)),
    safe(() => api.filter!({ target_audience: 'all' }, '-created_date', REMOTE_LIMIT)),
  ]);

  const byId = new Map<string, AppNotificationRow>();
  for (const row of [...mine, ...broadcast]) {
    if (row?.id) byId.set(row.id, row);
  }
  return [...byId.values()];
};

const fetchReadState = async (email: string): Promise<NotificationReadRow[]> => {
  const api = NotificationRead() as unknown as EntityApi<NotificationReadRow>;
  if (typeof api?.filter !== 'function') return [];
  return safe(() => api.filter!({ user_email: email }, '-created_date', 500));
};

interface FeedPayload {
  items: NotificationItem[];
  /** Identifiants marqués lus côté serveur, à fusionner dans le cache local. */
  serverReadIds: string[];
}

const buildFeed = (
  notifications: AppNotificationRow[],
  orders: OrderRow[],
  messages: MessageRow[],
  reads: NotificationReadRow[],
): FeedPayload => {
  const hidden = new Set(
    reads.filter((r) => r.deleted && r.notification_id).map((r) => r.notification_id as string),
  );
  const serverReadIds = reads
    .filter((r) => r.is_read && r.notification_id)
    .map((r) => r.notification_id as string);

  const remoteItems: NotificationItem[] = notifications
    .filter((n) => !hidden.has(n.id))
    .map((n) => {
      const kind = remoteKind(n);
      return {
        id: n.id,
        kind,
        title: n.title?.trim() || 'AfriGo',
        body: n.message?.trim() || '',
        date: n.created_date ?? null,
        orderId: kind === 'order' ? (n.related_id ?? undefined) : undefined,
        productId: kind === 'product' ? (n.related_id ?? undefined) : undefined,
        imageUrl: n.image_url ?? n.images?.[0],
        unread: false,
      };
    });

  // Les commandes déjà couvertes par une notification `delivery_status` ne sont
  // pas re-dérivées : sinon la même livraison apparaîtrait deux fois.
  const ordersCoveredRemotely = new Set(
    notifications
      .filter((n) => n.related_type === 'order' && n.related_id)
      .map((n) => n.related_id as string),
  );

  const orderItems: NotificationItem[] = orders
    .filter((o) => !ordersCoveredRemotely.has(o.id))
    .map((o) => ({
      id: `order:${o.id}:${o.status ?? 'pending'}`,
      kind: 'order',
      title: `Commande ${orderLabel(o.id)}`,
      body: STATUS_TEXT[o.status ?? 'pending'] ?? 'Votre commande a été mise à jour.',
      date: o.updated_date ?? o.created_date ?? null,
      orderId: o.id,
      orderStatus: o.status,
      derived: true,
      unread: false,
    }));

  const messageItems: NotificationItem[] = messages
    .filter((m) => m.sender_type === 'admin')
    .map((m) => ({
      id: `message:${m.id}`,
      kind: 'message',
      title: 'Service client AfriGo',
      body: m.content?.trim() || 'Vous avez reçu un nouveau message.',
      date: m.created_date ?? null,
      derived: true,
      unread: false,
    }));

  const items = [...remoteItems, ...orderItems, ...messageItems]
    .filter((i) => !hidden.has(i.id))
    .sort((a, b) => toMs(b.date) - toMs(a.date));

  return { items, serverReadIds };
};

/**
 * Fil de notifications + compteur non lus. Volontairement tolérant : si une
 * source échoue (droits, réseau), on retourne simplement les autres.
 */
export const useNotificationsFeed = () => {
  const { user } = useAuth();
  const email = user?.email;
  const queryClient = useQueryClient();
  const readVersion = useSyncExternalStore(subscribe, getVersion, getVersion);

  useEffect(() => {
    const previous = currentEmail;
    currentEmail = email ?? null;
    if (previous && email && previous !== email) resetNotificationsReadCache();
  }, [email]);

  const query = useQuery<FeedPayload>({
    queryKey: ['notificationsFeed', email],
    enabled: Boolean(email),
    refetchInterval: 60_000,
    queryFn: async () => {
      const [notifications, orders, messages, reads] = await Promise.all([
        fetchAppNotifications(email as string),
        safe(() => (Order() as unknown as EntityApi<OrderRow>).filter?.({ customer_email: email })),
        safe(() =>
          (Message() as unknown as EntityApi<MessageRow>).filter?.({ customer_email: email }),
        ),
        fetchReadState(email as string),
      ]);
      return buildFeed(notifications, orders, messages, reads);
    },
  });

  const data = query.data;

  // L'état « lu » du serveur alimente le cache local (multi-appareils).
  useEffect(() => {
    if (data?.serverReadIds?.length && mergeReadIds(data.serverReadIds)) emit();
  }, [data]);

  const items = useMemo(
    () =>
      (data?.items ?? [])
        .filter((item) => !hiddenIdSet.has(item.id))
        .map((item) => ({
          ...item,
          unread: isUnread(item),
        })),
    // `readVersion` force le recalcul quand l'état de lecture change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, readVersion],
  );

  const unreadCount = useMemo(() => items.filter((i) => i.unread).length, [items]);

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  const markAllRead = useCallback(() => {
    markAllNotificationsRead(items.filter((i) => i.unread).map((i) => i.id));
  }, [items]);

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['notificationsFeed'] });
  }, [queryClient]);

  return {
    items,
    unreadCount,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    refresh,
    invalidate,
    markRead: markNotificationRead,
    markAllRead,
    remove: deleteNotification,
  };
};

/** Compteur seul — utilisé par les barres de navigation. */
export const useUnreadNotificationsCount = () => useNotificationsFeed().unreadCount;
