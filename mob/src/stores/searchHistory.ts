import { create } from 'zustand';
import { kv, STORAGE_KEYS, hydrateKvFromDisk } from '@/services/storage';

/** Nombre maximum de recherches récentes conservées. */
const MAX_ENTRIES = 8;

interface SearchHistoryState {
  terms: string[];
  /** Recharge l'historique depuis le stockage local (au montage de l'écran). */
  hydrate: () => Promise<void>;
  /** Ajoute (ou remonte) un terme en tête de liste. */
  push: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}

function persist(terms: string[]) {
  kv.set(STORAGE_KEYS.SEARCH_HISTORY, terms);
}

/** Historique des recherches, affiché quand le champ de recherche est vide. */
export const useSearchHistory = create<SearchHistoryState>((set, get) => ({
  terms: [],

  hydrate: async () => {
    await hydrateKvFromDisk();
    const stored = kv.get<string[]>(STORAGE_KEYS.SEARCH_HISTORY);
    if (Array.isArray(stored)) {
      set({ terms: stored.filter((t) => typeof t === 'string').slice(0, MAX_ENTRIES) });
    }
  },

  push: (term) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const terms = [
      trimmed,
      ...get().terms.filter((t) => t.toLowerCase() !== lower),
    ].slice(0, MAX_ENTRIES);
    set({ terms });
    persist(terms);
  },

  remove: (term) => {
    const terms = get().terms.filter((t) => t !== term);
    set({ terms });
    persist(terms);
  },

  clear: () => {
    set({ terms: [] });
    persist([]);
  },
}));
