/**
 * Globaux web attendus par @base44/sdk (analytics) sur React Native / Hermes,
 * dont le mode bridgeless (NOBRIDGE) où lire `globalThis.document` peut lever
 * « Property 'document' doesn't exist » avant toute valeur `undefined`.
 */
type MiniWindow = {
  location?: Record<string, unknown>;
  history?: { replaceState?: () => void; pushState?: () => void };
  addEventListener?: (ev: string, fn: () => void) => void;
  removeEventListener?: (ev: string, fn: () => void) => void;
};

/** Désactive le module analytics du SDK (sinon il appelle `auth.me()` sans jeton → 401 bruyants). */
const RN_LOCATION_SEARCH = '?analytics-enable=false';

function ensureAnalyticsDisabledInSearch(loc: Record<string, unknown>) {
  let raw = typeof loc.search === 'string' ? loc.search.trim() : '';
  if (!raw || raw === '?') {
    loc.search = RN_LOCATION_SEARCH;
    return;
  }
  const q = raw.startsWith('?') ? raw.slice(1) : raw;
  const params = new URLSearchParams(q);
  if (params.get('analytics-enable') == null) {
    params.set('analytics-enable', 'false');
    loc.search = params.toString() ? `?${params.toString()}` : RN_LOCATION_SEARCH;
  }
}

const docStub = {
  referrer: '',
  visibilityState: 'visible',
};

function patchDocument(target: object) {
  try {
    Object.defineProperty(target, 'document', {
      value: docStub,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } catch {
    try {
      (target as { document: typeof docStub }).document = docStub;
    } catch {
      /* ignore */
    }
  }
}

patchDocument(globalThis);

const gn = globalThis as typeof globalThis & { global?: object };
if (gn.global != null && gn.global !== globalThis) {
  patchDocument(gn.global);
}

let w: (MiniWindow & Record<string, unknown>) | undefined;
try {
  w = (globalThis as unknown as { window?: (MiniWindow & Record<string, unknown>) | undefined }).window;
} catch {
  w = undefined;
}

if (w) {
  if (typeof w.addEventListener !== 'function') {
    w.addEventListener = () => {};
    w.removeEventListener = () => {};
  }
  if (
    w.history == null ||
    typeof w.history !== 'object' ||
    typeof (w.history as MiniWindow['history'])?.replaceState !== 'function'
  ) {
    w.history = {
      replaceState: () => {},
      pushState: () => {},
    };
  }
  if (w.location == null || typeof w.location !== 'object') {
    w.location = {
      search: RN_LOCATION_SEARCH,
      pathname: '/',
      href: `app:///${RN_LOCATION_SEARCH}`,
      assign: () => {},
      replace: () => {},
      reload: () => {},
    };
  } else {
    const loc = w.location as Record<string, unknown>;
    ensureAnalyticsDisabledInSearch(loc);
    if (typeof loc.pathname !== 'string') loc.pathname = '/';
  }
}
