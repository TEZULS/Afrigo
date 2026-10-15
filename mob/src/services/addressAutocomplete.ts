/**
 * Autocomplétion d'adresses françaises via la Base Adresse Nationale (BAN).
 *
 * API publique de l'État (api-adresse.data.gouv.fr) : gratuite, sans clé,
 * sans quota contraignant (50 req/s/IP). Elle renvoie du GeoJSON dont on
 * extrait rue / code postal / ville pour remplir le formulaire d'un coup.
 *
 * Docs : https://adresse.data.gouv.fr/api-doc/adresse
 */

import type { NearbyPosition } from '@/services/nearbyPosition';

const BAN_ENDPOINT = 'https://api-adresse.data.gouv.fr/search/';

/** La BAN refuse les requêtes de moins de 3 caractères. */
export const MIN_ADDRESS_QUERY_LENGTH = 3;

const REQUEST_TIMEOUT_MS = 6000;
const CACHE_MAX_ENTRIES = 60;

export type AddressKind = 'housenumber' | 'street' | 'municipality' | 'locality';

export interface AddressSuggestion {
  /** Identifiant BAN (clé de liste stable). */
  id: string;
  /** Libellé complet : « 12 Rue de la République 51000 Châlons-en-Champagne ». */
  label: string;
  /** Ligne adresse seule : « 12 Rue de la République ». */
  street: string;
  postalCode: string;
  city: string;
  /** « 51, Marne, Grand Est » — affiché en sous-titre de la suggestion. */
  context: string;
  kind: AddressKind;
}

interface BanFeature {
  properties?: {
    id?: string;
    label?: string;
    name?: string;
    street?: string;
    postcode?: string;
    city?: string;
    context?: string;
    type?: string;
  };
}

interface BanResponse {
  features?: BanFeature[];
}

export interface SearchAddressesOptions {
  /** Nombre max de suggestions (BAN : 1 à 20). */
  limit?: number;
  /** Restreint la recherche à un code postal déjà saisi par l'utilisateur. */
  postalCode?: string;
  /**
   * Position approximative du client : la BAN classe alors en tête les
   * adresses et communes les plus proches (sans exclure les autres).
   */
  near?: NearbyPosition | null;
  signal?: AbortSignal;
}

/** Cache mémoire simple : évite de refrapper l'API sur les retours en arrière. */
const cache = new Map<string, AddressSuggestion[]>();

function cacheKey(
  scope: string,
  query: string,
  postalCode?: string,
  near?: NearbyPosition | null,
): string {
  const where = near ? `${near.lat},${near.lon}` : '';
  return `${scope}|${query.trim().toLowerCase()}|${postalCode?.trim() ?? ''}|${where}`;
}

/** Priorité de proximité, comprise par la BAN via `lat` / `lon`. */
function applyNear(params: URLSearchParams, near?: NearbyPosition | null): void {
  if (!near) return;
  params.set('lat', String(near.lat));
  params.set('lon', String(near.lon));
}

function rememberInCache(key: string, value: AddressSuggestion[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

function toKind(raw: string | undefined): AddressKind {
  if (raw === 'housenumber' || raw === 'street' || raw === 'municipality' || raw === 'locality') {
    return raw;
  }
  return 'locality';
}

function toSuggestion(feature: BanFeature, index: number): AddressSuggestion | null {
  const p = feature.properties;
  if (!p) return null;
  const city = p.city?.trim() ?? '';
  const postalCode = p.postcode?.trim() ?? '';
  if (!city) return null;
  const kind = toKind(p.type);
  // Sur une commune la BAN renvoie `name = ville` : pas de rue à pré-remplir.
  const street = kind === 'municipality' ? '' : (p.name?.trim() ?? p.street?.trim() ?? '');
  return {
    id: p.id?.trim() || `${postalCode}-${city}-${index}`,
    label: p.label?.trim() || [street, postalCode, city].filter(Boolean).join(' '),
    street,
    postalCode,
    city,
    context: p.context?.trim() ?? '',
    kind,
  };
}

/**
 * Interroge la BAN et convertit la réponse.
 *
 * Ne lève jamais pour une simple absence de réseau : l'autocomplétion est un
 * confort, la saisie manuelle doit rester possible. Renvoie `[]` en cas
 * d'échec, et propage uniquement l'`AbortError` (frappe suivante).
 */
async function queryBan(
  params: URLSearchParams,
  key: string,
  signal: AbortSignal | undefined,
): Promise<AddressSuggestion[]> {
  const cached = cache.get(key);
  if (cached) return cached;

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  // `addEventListener` sur AbortSignal manque sur certains runtimes RN anciens.
  const canForwardAbort = typeof signal?.addEventListener === 'function';
  if (canForwardAbort) signal?.addEventListener('abort', abortFromCaller);
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BAN_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const body = (await res.json()) as BanResponse;
    const suggestions = (body.features ?? [])
      .map(toSuggestion)
      .filter((s): s is AddressSuggestion => s !== null);
    rememberInCache(key, suggestions);
    return suggestions;
  } catch (err) {
    // Annulation demandée par l'appelant : on remonte pour qu'il ignore le résultat.
    if (signal?.aborted) throw err;
    return [];
  } finally {
    clearTimeout(timeout);
    if (canForwardAbort) signal?.removeEventListener('abort', abortFromCaller);
  }
}

/**
 * Recherche les adresses correspondant à la saisie.
 *
 * `postalCode` est le levier décisif : sans lui la BAN répond à l'échelle
 * nationale (« 12 rue de la République » renvoie Toulouse, Argenteuil, Nîmes…
 * et aucune adresse châlonnaise dans les 12 premiers résultats). Avec lui, elle
 * ne renvoie que les voies de la commune. D'où l'ordre du formulaire :
 * ville / code postal d'abord, adresse ensuite.
 */
export async function searchAddresses(
  query: string,
  options: SearchAddressesOptions = {},
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < MIN_ADDRESS_QUERY_LENGTH) return [];

  const postalCode = options.postalCode?.trim();
  const params = new URLSearchParams({
    q,
    limit: String(options.limit ?? 5),
    autocomplete: '1',
  });
  // La BAN n'accepte le filtre `postcode` qu'une fois le code postal complet.
  if (postalCode && /^[0-9]{5}$/.test(postalCode)) params.set('postcode', postalCode);
  applyNear(params, options.near);

  return queryBan(params, cacheKey('adr', q, postalCode, options.near), options.signal);
}

/**
 * Recherche les communes correspondant à la saisie.
 *
 * Sert à remplir Ville + Code postal en un tap. La BAN est tolérante aux
 * fautes : « chalons » propose « Châlons-en-Champagne 51000 » en tête.
 */
export async function searchCities(
  query: string,
  options: Omit<SearchAddressesOptions, 'postalCode'> = {},
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < MIN_ADDRESS_QUERY_LENGTH) return [];

  const params = new URLSearchParams({
    q,
    limit: String(options.limit ?? 5),
    autocomplete: '1',
    type: 'municipality',
  });
  applyNear(params, options.near);

  return queryBan(params, cacheKey('ville', q, undefined, options.near), options.signal);
}

/** Vide le cache (tests). */
export function __clearAddressCache(): void {
  cache.clear();
}
