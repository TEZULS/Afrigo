import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/services/storage';

/**
 * Variante telle que base44 la stocke dans `Product.variants` — on conserve
 * l'objet complet dans la ligne de panier car c'est lui qui est renvoyé tel
 * quel dans `CartItem.selected_variants` / `Order.items[].selected_variants`
 * (le back-office et la fonction `updateStockAfterOrder` y cherchent `type`,
 * `value` et le stock de la variante).
 */
export interface CartVariant {
  type?: string;
  value?: string;
  price_modifier?: number | null;
  promotion_price?: number | null;
  image_url?: string;
  stock_quantity?: number;
  color_code?: string | null;
}

export interface CartLine {
  productId: string;
  name: string;
  imageUrl?: string;
  unitPrice: number;
  quantity: number;
  variant?: CartVariant | null;
  category?: string;
  unit?: string;
  /**
   * Taux de TVA (%) du produit au moment de l'ajout — sert au détail
   * HT / TVA / TTC du panier et est recopié dans `Order.items[].vat_rate`.
   * Absent sur les lignes rechargées depuis le serveur (`CartItem` ne le
   * stocke pas) : `useCartVatRates` le retrouve alors sur le produit.
   */
  vatRate?: number | null;
}

/**
 * Origine des lignes en mémoire/persistance :
 * - `guest` : ajoutées hors-connexion → seront fusionnées avec le serveur à
 *   la prochaine connexion (additionnées aux lignes serveur).
 * - `synced` : reflètent déjà l'état serveur. Au reload de l'app on NE
 *   re-fusionne PAS, sinon les quantités doublent à chaque démarrage.
 */
export type CartSource = 'guest' | 'synced';

interface CartState {
  lines: CartLine[];
  source: CartSource;
  add: (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => void;
  remove: (productId: string, variantValue?: string | null) => void;
  setQuantity: (productId: string, qty: number, variantValue?: string | null) => void;
  replaceLines: (lines: CartLine[]) => void;
  setSource: (source: CartSource) => void;
  clear: () => void;
  count: () => number;
  total: () => number;
}

/**
 * Clé stable d'une ligne (produit + variante) — sert à la sélection dans le
 * panier et à ne commander que les lignes cochées.
 */
export const cartLineKey = (line: Pick<CartLine, 'productId' | 'variant'>): string =>
  `${line.productId}-${line.variant?.value ?? ''}`;

const sameLine = (a: CartLine, productId: string, variantValue?: string | null): boolean =>
  a.productId === productId && (a.variant?.value ?? null) === (variantValue ?? null);

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      source: 'guest',
      add: (line) =>
        set((state) => {
          const idx = state.lines.findIndex((l) =>
            sameLine(l, line.productId, line.variant?.value ?? null),
          );
          const qty = line.quantity ?? 1;
          if (idx >= 0) {
            const next = [...state.lines];
            const existing = next[idx]!;
            next[idx] = { ...existing, quantity: existing.quantity + qty };
            return { lines: next };
          }
          return { lines: [...state.lines, { ...line, quantity: qty }] };
        }),
      remove: (productId, variantValue) =>
        set((state) => {
          const idx = state.lines.findIndex((l) => sameLine(l, productId, variantValue));
          if (idx < 0) return state;
          const next = [...state.lines];
          const existing = next[idx]!;
          if (existing.quantity > 1) {
            next[idx] = { ...existing, quantity: existing.quantity - 1 };
          } else {
            next.splice(idx, 1);
          }
          return { lines: next };
        }),
      setQuantity: (productId, qty, variantValue) =>
        set((state) => {
          const idx = state.lines.findIndex((l) => sameLine(l, productId, variantValue));
          if (idx < 0) return state;
          const next = [...state.lines];
          if (qty <= 0) {
            next.splice(idx, 1);
          } else {
            const existing = next[idx]!;
            next[idx] = { ...existing, quantity: qty };
          }
          return { lines: next };
        }),
      replaceLines: (lines) => set({ lines }),
      setSource: (source) => set({ source }),
      clear: () => set({ lines: [], source: 'guest' }),
      count: () => get().lines.reduce((acc, l) => acc + l.quantity, 0),
      total: () => get().lines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0),
    }),
    {
      name: STORAGE_KEYS.GUEST_CART,
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: (persistedState, version) => {
        // Migration v1 → v2 : panier déjà persisté est considéré « synced »
        // pour éviter une fusion ×2 lors du premier démarrage post-update.
        if (version < 2 && persistedState && typeof persistedState === 'object') {
          return { ...(persistedState as object), source: 'synced' as CartSource };
        }
        return persistedState as CartState;
      },
    },
  ),
);
