import { useEffect, useRef, useState } from 'react';
import {
  searchAddresses,
  searchCities,
  MIN_ADDRESS_QUERY_LENGTH,
  type AddressSuggestion,
} from '@/services/addressAutocomplete';

/** Délai d'inactivité avant d'interroger la BAN (évite 1 requête par touche). */
const DEBOUNCE_MS = 320;

/** Ce que l'on cherche : une adresse précise, ou une commune. */
export type AutocompleteKind = 'address' | 'city';

export interface UseAddressAutocompleteOptions {
  /** Désactive la recherche (champ non focus, suggestion tout juste choisie…). */
  enabled?: boolean;
  kind?: AutocompleteKind;
  /**
   * Code postal déjà saisi. C'est le levier décisif : sans lui la BAN répond à
   * l'échelle nationale (« rue de la République » renvoie Toulouse, Argenteuil,
   * Nîmes…), avec lui elle ne renvoie que les rues de la commune.
   */
  postalCode?: string;
  limit?: number;
}

export interface UseAddressAutocompleteResult {
  suggestions: AddressSuggestion[];
  loading: boolean;
}

/**
 * Suggestions d'adresses ou de communes pour la saisie `query`, debouncées et
 * annulables. Ne renvoie jamais d'erreur : si la BAN est injoignable, la liste
 * reste vide et l'utilisateur saisit son adresse à la main.
 */
export function useAddressAutocomplete(
  query: string,
  { enabled = true, kind = 'address', postalCode, limit = 5 }: UseAddressAutocompleteOptions = {},
): UseAddressAutocompleteResult {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!enabled || trimmed.length < MIN_ADDRESS_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      const run =
        kind === 'city'
          ? searchCities(trimmed, { limit, signal: controller.signal })
          : searchAddresses(trimmed, { limit, postalCode, signal: controller.signal });

      run
        .then((res) => {
          if (controller.signal.aborted || !mounted.current) return;
          setSuggestions(res);
          setLoading(false);
        })
        .catch(() => {
          // Requête annulée par la frappe suivante : le prochain effet prend le relais.
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, enabled, kind, postalCode, limit]);

  return { suggestions, loading };
}
