/**
 * Distributeur des notifications push (le seul expéditeur de push d'AfriGo).
 *
 * Déclenché par le Workflow base44 « Push – envoi immédiat » à **chaque
 * création d'`AppNotification`** (cf. `base44/workflows/`) : la push part
 * aussitôt, quelle que soit l'origine de la notification (formulaire « Envoyer
 * une notification » de l'admin, suivi de commande, promotions, relance
 * panier). Le Workflow « Push – nouvel essai », toutes les 15 minutes
 * (`{"mode": "retry"}`), rattrape les envois échoués ; il laisse au premier les
 * notifications de moins de 2 minutes, pour ne jamais envoyer deux fois.
 * (Cette app utilise les Workflows : les automatisations attachées aux
 * fonctions y sont désactivées.)
 *
 * Deux voies d'envoi, une seule par appareil :
 *   - **Apple direct (APNs)** pour les iPhone, si les secrets `APNS_KEY_P8`,
 *     `APNS_KEY_ID` et `APNS_TEAM_ID` sont définis (clé .p8 créée sur
 *     developer.apple.com → Keys → Apple Push Notifications service) ;
 *   - **Expo** sinon (Android, ou iPhone sans clé APNs côté base44 — Expo a
 *     alors besoin de la clé APNs dans `eas credentials`).
 *
 * Schéma requis (base44 → Data) :
 *   - User : `expo_push_token`, `apns_device_token` (texte), `push_enabled`
 *     (booléen), `push_platform`, `push_token_updated_at` (texte) ;
 *   - AppNotification : `push_sent` (booléen, défaut false) — sans lui la
 *     fonction refuse d'envoyer, pour ne jamais renvoyer la même notification.
 *     Facultatifs : `push_error` (texte), `push_attempts` (nombre).
 *
 * Sécurité : sans le secret `PUSH_DISPATCH_SECRET` (en-tête
 * `x-dispatch-secret` ou champ `cronSecret` du corps) ni session admin, un
 * appel ne fait que ce que fait la tâche planifiée (fenêtre et volume par
 * défaut) et ne renvoie aucun chiffre. Paramètres réservés aux appels de
 * confiance (POST JSON) :
 *   { "sinceMinutes": 15, "limit": 200, "dryRun": false, "notificationIds": [] }
 * Filtre facultatif : secret `PUSH_TYPES` (ex. « manual,delivery_status »)
 * pour ne pousser que certains types.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const EXPO_BATCH_SIZE = 100;
const ANDROID_CHANNEL_ID = 'afrigo-default';
const IOS_BUNDLE_ID = 'app.afrigo.mobile';

/** Fenêtre de rattrapage : 1 h, soit jusqu'à 3 essais avec un passage toutes les 15 min. */
const DEFAULT_SINCE_MINUTES = 60;
const DEFAULT_LIMIT = 200;
const MAX_SINCE_MINUTES = 24 * 60;
const MAX_LIMIT = 500;
/** Au-delà, une notification qui échoue n'est plus retentée. */
const MAX_ATTEMPTS = 3;
/** En mode « nouvel essai », les notifications plus jeunes sont laissées au déclencheur. */
const RETRY_MIN_AGE_MS = 2 * 60_000;
/** Attente avant la lecture des accusés Expo (erreurs Apple / Google). */
const RECEIPT_DELAY_MS = 3000;

const isExpoToken = (token: unknown): token is string =>
  typeof token === 'string' &&
  (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

/** Jeton APNs natif : hexadécimal (64 caractères aujourd'hui, jusqu'à 200). */
const isApnsToken = (token: unknown): token is string =>
  typeof token === 'string' && /^[0-9a-fA-F]{64,200}$/.test(token);

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Dates base44 en UTC sans suffixe (« 2026-09-13T17:53:12.997000 »). */
const serverTime = (s: unknown): number => {
  if (typeof s !== 'string' || !s) return NaN;
  return Date.parse(/(Z|[+-]\d{2}:?\d{2})$/i.test(s) ? s : `${s}Z`);
};

/** Texte coupé proprement (APNs / FCM refusent les charges de plus de 4 Ko). */
const clip = (s: unknown, max: number): string => {
  const cps = [...String(s ?? '')];
  return cps.length <= max ? cps.join('') : `${cps.slice(0, max).join('')}…`;
};

/** Comparaison à temps constant du secret. */
const sameSecret = (given: string, secret: string): boolean => {
  if (secret.length < 16 || given.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i += 1) diff |= given.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
};

// ---------------------------------------------------------------- APNs direct

const b64url = (data: ArrayBuffer | Uint8Array | string): string => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Contenu du fichier AuthKey_XXXX.p8 (collé tel quel, ou sur une ligne avec des \n). */
const p8ToDer = (p8: string): ArrayBuffer => {
  const b64 = p8
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

interface ApnsConfig {
  keyP8: string;
  keyId: string;
  teamId: string;
  host: string;
}

const apnsConfig = (): ApnsConfig | null => {
  const keyP8 = Deno.env.get('APNS_KEY_P8') ?? '';
  const keyId = Deno.env.get('APNS_KEY_ID') ?? '';
  const teamId = Deno.env.get('APNS_TEAM_ID') ?? '';
  if (!keyP8 || !keyId || !teamId) return null;
  // TestFlight et App Store = production ; « development » seulement pour un build de dev.
  const sandbox = (Deno.env.get('APNS_ENV') ?? '').toLowerCase() === 'development';
  return {
    keyP8,
    keyId,
    teamId,
    host: sandbox ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com',
  };
};

/**
 * Jeton d'authentification APNs (JWT ES256). Apple le refuse au-delà d'une
 * heure et répond 429 s'il change plus d'une fois toutes les 20 min : on le
 * garde 30 min.
 */
let apnsJwtCache: { bucket: number; keyId: string; jwt: string } | null = null;

const apnsJwt = async (cfg: ApnsConfig): Promise<string> => {
  const bucket = Math.floor(Date.now() / 1000 / 1800) * 1800;
  if (apnsJwtCache && apnsJwtCache.bucket === bucket && apnsJwtCache.keyId === cfg.keyId) {
    return apnsJwtCache.jwt;
  }
  const key = await crypto.subtle.importKey(
    'pkcs8',
    p8ToDer(cfg.keyP8),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: cfg.keyId }));
  const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat: bucket }));
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const jwt = `${header}.${claims}.${b64url(signature)}`;
  apnsJwtCache = { bucket, keyId: cfg.keyId, jwt };
  return jwt;
};

// ---------------------------------------------------------------- Destinataires

interface Device {
  userId: string;
  email: string;
  channel: 'apns' | 'expo';
  token: string;
}

interface Directory {
  /** Un appareil par jeton : le compte qui l'a enregistré en dernier. */
  all: Device[];
  byEmail: Map<string, Device[]>;
}

const loadDirectory = async (svc: any, useApns: boolean): Promise<Directory> => {
  const owners = new Map<string, { device: Device; updatedAt: string }>();
  const page = 100;
  for (let skip = 0; ; skip += page) {
    const batch = await svc.User.list('created_date', page, skip, [
      'id',
      'email',
      'expo_push_token',
      'apns_device_token',
      'push_enabled',
      'push_token_updated_at',
    ]);
    if (!batch?.length) break;
    for (const u of batch) {
      if (u?.push_enabled === false || !u?.email) continue;
      // iPhone : Apple direct si configuré, sinon Expo. Android : Expo.
      const device: Device | null =
        useApns && isApnsToken(u.apns_device_token)
          ? { userId: u.id, email: String(u.email), channel: 'apns', token: u.apns_device_token }
          : isExpoToken(u.expo_push_token)
            ? { userId: u.id, email: String(u.email), channel: 'expo', token: u.expo_push_token }
            : null;
      if (!device) continue;
      const updatedAt = String(u.push_token_updated_at ?? '');
      const current = owners.get(device.token);
      if (!current || updatedAt > current.updatedAt) owners.set(device.token, { device, updatedAt });
    }
    if (batch.length < page) break;
  }
  const all = [...owners.values()].map((o) => o.device);
  const byEmail = new Map<string, Device[]>();
  for (const d of all) {
    const key = d.email.trim().toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), d]);
  }
  return { all, byEmail };
};

/** Comme le fil du site et de l'app : public seulement si `target_audience === 'all'`. */
const recipientsOf = (n: any, dir: Directory): Device[] => {
  if (n?.target_audience === 'all') return dir.all;
  const emails: string[] = Array.isArray(n?.target_emails) ? n.target_emails : [];
  const seen = new Set<string>();
  const out: Device[] = [];
  for (const e of emails) {
    for (const d of dir.byEmail.get(String(e).trim().toLowerCase()) ?? []) {
      if (!seen.has(d.token)) {
        seen.add(d.token);
        out.push(d);
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------- Envoi

interface SendOutcome {
  accepted: number;
  errors: string[];
}

/** Ticket Expo accepté, à confronter plus tard à son accusé de remise. */
interface Ticket {
  id: string;
  device: Device;
  notificationId: string;
}

const routingData = (n: any) => ({
  notificationId: n.id,
  type: n.type ?? 'manual',
  relatedType: n.related_type ?? undefined,
  relatedId: n.related_id ?? undefined,
});

const sendExpo = async (
  devices: Device[],
  n: any,
  deadTokens: Map<string, Device>,
): Promise<SendOutcome & { tickets: Ticket[] }> => {
  const out = { accepted: 0, errors: [] as string[], tickets: [] as Ticket[] };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';
  for (const batch of chunk(devices, EXPO_BATCH_SIZE)) {
    const messages = batch.map((d) => ({
      to: d.token,
      sound: 'default',
      title: clip(n.title, 120),
      body: clip(n.message, 600),
      priority: 'high',
      channelId: ANDROID_CHANNEL_ID,
      data: routingData(n),
    }));
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Accept: 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(messages),
      });
      const json = await res.json().catch(() => null);
      const tickets = Array.isArray(json?.data) ? json.data : [];
      if (!tickets.length) {
        const why = json?.errors?.[0]?.message ?? `HTTP ${res.status}`;
        out.errors.push(`Expo : ${why}`);
        continue;
      }
      tickets.forEach((t: any, i: number) => {
        const device = batch[i];
        if (t?.status === 'ok') {
          out.accepted += 1;
          if (t.id && device) out.tickets.push({ id: t.id, device, notificationId: n.id });
        } else {
          out.errors.push(`Expo : ${t?.message ?? 'erreur inconnue'}`);
          if (t?.details?.error === 'DeviceNotRegistered' && device) deadTokens.set(device.token, device);
        }
      });
    } catch (err) {
      out.errors.push(`Expo injoignable : ${err?.message ?? err}`);
    }
  }
  return out;
};

/**
 * Accusés Expo : c'est là qu'apparaissent les refus d'Apple / Google
 * (InvalidCredentials = clé APNs ou FCM absente côté EAS). Lecture rapide,
 * quelques secondes après l'envoi ; les accusés pas encore prêts sont ignorés.
 */
const checkExpoReceipts = async (
  tickets: Ticket[],
  deadTokens: Map<string, Device>,
): Promise<Map<string, string[]>> => {
  const errors = new Map<string, string[]>();
  if (!tickets.length) return errors;
  await new Promise((resolve) => setTimeout(resolve, RECEIPT_DELAY_MS));
  const byId = new Map(tickets.map((t) => [t.id, t]));
  for (const ids of chunk([...byId.keys()], 1000)) {
    try {
      const res = await fetch(EXPO_RECEIPTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json().catch(() => null);
      const receipts = json?.data && typeof json.data === 'object' ? json.data : {};
      for (const [id, r] of Object.entries<any>(receipts)) {
        if (r?.status === 'ok') continue;
        const code = r?.details?.error ?? 'erreur';
        const ticket = byId.get(id);
        if (!ticket) continue;
        const list = errors.get(ticket.notificationId) ?? [];
        list.push(`Accusé Expo ${code} : ${r?.message ?? ''}`.trim());
        errors.set(ticket.notificationId, list);
        if (code === 'DeviceNotRegistered') deadTokens.set(ticket.device.token, ticket.device);
      }
    } catch {
      /* accusés indisponibles : sans incidence sur l'envoi */
    }
  }
  return errors;
};

const sendApns = async (
  devices: Device[],
  n: any,
  cfg: ApnsConfig,
  deadTokens: Map<string, Device>,
): Promise<SendOutcome> => {
  const out = { accepted: 0, errors: [] as string[] };
  let jwt: string;
  try {
    jwt = await apnsJwt(cfg);
  } catch (err) {
    out.errors.push(`Clé APNs illisible (APNS_KEY_P8) : ${err?.message ?? err}`);
    return out;
  }
  // expo-notifications lit les données de navigation sous la clé « body ».
  const payload = JSON.stringify({
    aps: {
      alert: { title: clip(n.title, 120), body: clip(n.message, 600) },
      sound: 'default',
    },
    body: routingData(n),
  });
  const expiration = String(Math.floor(Date.now() / 1000) + 24 * 3600);
  for (const batch of chunk(devices, 20)) {
    await Promise.all(
      batch.map(async (d) => {
        try {
          const res = await fetch(`${cfg.host}/3/device/${d.token}`, {
            method: 'POST',
            headers: {
              authorization: `bearer ${jwt}`,
              'apns-topic': IOS_BUNDLE_ID,
              'apns-push-type': 'alert',
              'apns-priority': '10',
              'apns-expiration': expiration,
              'content-type': 'application/json',
            },
            body: payload,
          });
          if (res.status === 200) {
            out.accepted += 1;
            return;
          }
          const reason = (await res.json().catch(() => null))?.reason ?? `HTTP ${res.status}`;
          out.errors.push(`Apple : ${reason}`);
          // 410 = appli désinstallée / jeton périmé. (BadDeviceToken peut venir
          // d'un build de dev : on ne l'efface pas.)
          if (res.status === 410) deadTokens.set(d.token, d);
        } catch (err) {
          out.errors.push(`Apple injoignable : ${err?.message ?? err}`);
        }
      }),
    );
  }
  return out;
};

// ---------------------------------------------------------------- Handler

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));

    // Appel de confiance : secret partagé (tâche planifiée) ou admin connecté.
    const secret = Deno.env.get('PUSH_DISPATCH_SECRET') ?? '';
    const given = req.headers.get('x-dispatch-secret') ?? String(body?.cronSecret ?? '');
    let trusted = sameSecret(given, secret);
    if (!trusted) {
      try {
        trusted = (await base44.auth.me())?.role === 'admin';
      } catch {
        trusted = false;
      }
    }

    const sinceMinutes = trusted
      ? Math.min(MAX_SINCE_MINUTES, Math.max(1, Number(body?.sinceMinutes) || DEFAULT_SINCE_MINUTES))
      : DEFAULT_SINCE_MINUTES;
    const limit = trusted
      ? Math.min(MAX_LIMIT, Math.max(1, Number(body?.limit) || DEFAULT_LIMIT))
      : DEFAULT_LIMIT;
    const dryRun = trusted && body?.dryRun === true;
    const forcedIds: string[] =
      trusted && Array.isArray(body?.notificationIds) ? body.notificationIds.map(String) : [];
    // Passage planifié de rattrapage (arguments de l'automatisation).
    const retryMode = body?.mode === 'retry' || body?.function_args?.mode === 'retry';
    const reply = (stats: Record<string, unknown>, status = 200) =>
      Response.json(trusted ? { success: status < 400, ...stats } : { success: status < 400 }, { status });

    const allowedTypes = (Deno.env.get('PUSH_TYPES') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const cutoff = Date.now() - sinceMinutes * 60_000;
    const recent = (await svc.AppNotification.list('-created_date', limit)) ?? [];
    const forced = [];
    for (const id of forcedIds) {
      if (recent.some((n: any) => n?.id === id)) continue;
      try {
        const n = await svc.AppNotification.get(id);
        if (n) forced.push(n);
      } catch {
        /* id inconnu */
      }
    }
    const pending = [...recent, ...forced].filter(
      (n: any) =>
        n?.id &&
        (forcedIds.includes(n.id) ||
          (n.push_sent !== true &&
            serverTime(n.created_date) >= cutoff &&
            (!retryMode || serverTime(n.created_date) <= Date.now() - RETRY_MIN_AGE_MS) &&
            (Number(n.push_attempts) || 0) < MAX_ATTEMPTS)) &&
        (!allowedTypes.length || allowedTypes.includes(String(n.type ?? 'manual'))),
    );

    if (pending.length === 0) return reply({ scanned: recent.length, notifications: 0 });

    const apns = apnsConfig();
    const directory = await loadDirectory(svc, Boolean(apns));

    if (dryRun) {
      return reply({
        dryRun: true,
        channel: apns ? 'apple+expo' : 'expo',
        notifications: pending.length,
        devices: pending.reduce((sum: number, n: any) => sum + recipientsOf(n, directory).length, 0),
      });
    }

    const deadTokens = new Map<string, Device>();
    const results: any[] = [];
    const tickets: Ticket[] = [];

    for (const n of pending) {
      // Réservation AVANT l'envoi : une exécution parallèle ne la renverra pas.
      const claimed = await svc.AppNotification.update(n.id, { push_sent: true });
      if (claimed && typeof claimed === 'object' && claimed.push_sent !== true) {
        console.error('dispatchPushNotifications : champ push_sent absent du schéma AppNotification');
        return reply(
          { error: 'Ajoutez le champ booléen push_sent au schéma AppNotification avant tout envoi.' },
          500,
        );
      }

      const devices = recipientsOf(n, directory);
      const viaApns = apns ? devices.filter((d) => d.channel === 'apns') : [];
      const viaExpo = devices.filter((d) => d.channel === 'expo');

      const apple = apns && viaApns.length ? await sendApns(viaApns, n, apns, deadTokens) : { accepted: 0, errors: [] };
      const expo = viaExpo.length
        ? await sendExpo(viaExpo, n, deadTokens)
        : { accepted: 0, errors: [] as string[], tickets: [] };
      tickets.push(...expo.tickets);

      const accepted = apple.accepted + expo.accepted;
      const errors = [...apple.errors, ...expo.errors];

      if (devices.length > 0 && accepted === 0) {
        // Rien n'est parti : on libère la notification pour un nouvel essai.
        try {
          await svc.AppNotification.update(n.id, {
            push_sent: false,
            push_error: clip(errors[0] ?? 'échec', 300),
            push_attempts: (Number(n.push_attempts) || 0) + 1,
          });
        } catch (err) {
          console.error('Libération impossible pour', n.id, err?.message ?? err);
        }
      } else if (errors.length || devices.length === 0) {
        try {
          await svc.AppNotification.update(n.id, {
            push_error: clip(devices.length ? errors[0] : 'Aucun appareil inscrit', 300),
          });
        } catch {
          /* champ facultatif */
        }
      }
      if (errors.length) console.error('Push', n.id, errors.slice(0, 5));
      results.push({ id: n.id, devices: devices.length, accepted, errors: errors.slice(0, 5) });
    }

    // Accusés Expo lus une seule fois, pour toutes les notifications envoyées.
    const receiptErrors = await checkExpoReceipts(tickets, deadTokens);
    for (const r of results) {
      const errs = receiptErrors.get(r.id);
      if (!errs?.length) continue;
      r.errors = [...r.errors, ...errs].slice(0, 5);
      console.error('Push (accusés)', r.id, errs.slice(0, 5));
      try {
        await svc.AppNotification.update(r.id, { push_error: clip(errs[0], 300) });
      } catch {
        /* champ facultatif */
      }
    }

    // Jetons morts (appli désinstallée) : retirés des profils.
    for (const d of deadTokens.values()) {
      try {
        await svc.User.update(d.userId, d.channel === 'apns' ? { apns_device_token: null } : { expo_push_token: null });
      } catch {
        /* profil non modifiable */
      }
    }

    return reply({
      scanned: recent.length,
      notifications: pending.length,
      channel: apns ? 'apple+expo' : 'expo',
      delivered: results.reduce((s, r) => s + r.accepted, 0),
      removedTokens: deadTokens.size,
      results,
    });
  } catch (error) {
    console.error('dispatchPushNotifications:', error);
    return Response.json({ success: false, error: error?.message ?? String(error) }, { status: 500 });
  }
});
