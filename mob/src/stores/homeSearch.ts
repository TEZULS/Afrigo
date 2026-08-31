import { create } from 'zustand';

interface HomeSearchState {
  /** Dernier terme validé depuis l'écran de recherche plein écran. */
  query: string;
  /**
   * Compteur incrémenté à chaque validation. L'écran d'accueil observe cette
   * valeur : à chaque changement il applique `query` au catalogue et remonte
   * en haut de la liste. Un compteur (plutôt que `query` seul) permet de
   * re-déclencher l'action même si l'utilisateur relance la même recherche.
   */
  queryToken: number;
  applyQuery: (query: string) => void;
}

/** Piloté par l'écran « Recherche » ouvert depuis la barre de navigation. */
export const useHomeSearch = create<HomeSearchState>((set, get) => ({
  query: '',
  queryToken: 0,
  applyQuery: (query) => set({ query, queryToken: get().queryToken + 1 }),
}));
