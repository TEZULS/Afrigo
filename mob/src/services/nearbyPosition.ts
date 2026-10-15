import * as Location from 'expo-location';

/** Position approximative du client, pour classer les adresses proposées. */
export interface NearbyPosition {
  lat: number;
  lon: number;
}

/** Une position reste valable 10 min : inutile de rallumer le GPS à chaque frappe. */
const MAX_AGE_MS = 10 * 60 * 1000;
const FIX_TIMEOUT_MS = 4000;

let cached: { at: number; pos: NearbyPosition | null } | null = null;
let pending: Promise<NearbyPosition | null> | null = null;

/**
 * Arrondi à 2 décimales (~1 km) : assez pour proposer les rues du quartier,
 * sans transmettre l'emplacement exact du client à la BAN.
 */
const round = (n: number) => Math.round(n * 100) / 100;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

async function locate(): Promise<NearbyPosition | null> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status === 'undetermined') perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;

    const fix =
      (await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS })) ??
      (await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
        FIX_TIMEOUT_MS,
      ));
    if (!fix) return null;
    return { lat: round(fix.coords.latitude), lon: round(fix.coords.longitude) };
  } catch {
    // Localisation coupée, refusée ou indisponible : suggestions nationales.
    return null;
  }
}

/**
 * Demande la localisation (une seule fois) puis renvoie une position
 * approximative, ou `null` si le client refuse : l'autocomplétion fonctionne
 * alors comme avant, à l'échelle de la France.
 */
export function getNearbyPosition(): Promise<NearbyPosition | null> {
  if (cached && Date.now() - cached.at < MAX_AGE_MS) return Promise.resolve(cached.pos);
  if (!pending) {
    pending = locate().then((pos) => {
      cached = { at: Date.now(), pos };
      pending = null;
      return pos;
    });
  }
  return pending;
}

/** Oublie la position mémorisée (tests). */
export function __resetNearbyPosition(): void {
  cached = null;
  pending = null;
}
