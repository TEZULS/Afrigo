/**
 * Distributeur planifié des notifications push.
 *
 * À exécuter en tâche planifiée (toutes les 1 à 5 minutes) : il pousse sur les
 * téléphones toute `AppNotification` récente pas encore envoyée — quelle que
 * soit son origine (envoi manuel de l'admin, suivi de livraison, relance
 * panier). Aucune modification de l'admin n'est donc nécessaire : il suffit que
 * la ligne `AppNotification` soit créée comme aujourd'hui.
 *
 * Idempotence : la fonction écrit `push_sent: true` sur la notification traitée.
 * **Ce champ booléen doit exister dans le schéma `AppNotification`** ; sinon
 * base44 ignore l'écriture et une même notification serait renvoyée à chaque
 * passage à l'intérieur de la fenêtre `sinceMinutes`.
 *
 * Paramètres optionnels (POST JSON) :
 *   { "sinceMinutes": 15, "limit": 200, "dryRun": false }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100;
const ANDROID_CHANNEL_ID = 'afrigo-default';

/** Fenêtre par défaut : large devant la période du cron, pour absorber un retard. */
const DEFAULT_SINCE_MINUTES = 15;
const DEFAULT_LIMIT = 200;

const isExpoToken = (token: unknown): token is string =>
  typeof token === 'string' &&
  (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole.entities;

    const body = await req.json().catch(() => ({}));
    const sinceMinutes = Number(body?.sinceMinutes) || DEFAULT_SINCE_MINUTES;
    const limit = Number(body?.limit) || DEFAULT_LIMIT;
    const dryRun = body?.dryRun === true;

    const cutoff = Date.now() - sinceMinutes * 60_000;

    const recent = await svc.AppNotification.list('-created_date', limit);
    const pending = (recent ?? []).filter(
      (n: any) => n?.push_sent !== true && new Date(n?.created_date ?? 0).getTime() >= cutoff,
    );

    if (pending.length === 0) {
      return Response.json({ success: true, scanned: recent?.length ?? 0, pushed: 0 });
    }

    // Les jetons sont résolus une seule fois par passage : une diffusion « all »
    // et plusieurs notifications ciblées partagent le même annuaire.
    const tokensByEmail = new Map<string, string>();
    const allTokens: string[] = [];
    let skip = 0;
    const page = 100;
    for (;;) {
      const batch = await svc.User.list(undefined, page, skip);
      if (!batch?.length) break;
      for (const u of batch) {
        if (isExpoToken(u?.expo_push_token)) {
          allTokens.push(u.expo_push_token);
          if (u.email) tokensByEmail.set(String(u.email).toLowerCase(), u.expo_push_token);
        }
      }
      if (batch.length < page) break;
      skip += page;
    }

    const messages: any[] = [];
    for (const n of pending) {
      const targets =
        n.target_audience === 'specific'
          ? (Array.isArray(n.target_emails) ? n.target_emails : [])
              .map((e: string) => tokensByEmail.get(String(e).toLowerCase()))
              .filter(isExpoToken)
          : allTokens;

      for (const to of targets) {
        messages.push({
          to,
          sound: 'default',
          title: n.title,
          body: n.message,
          priority: 'high',
          channelId: ANDROID_CHANNEL_ID,
          data: {
            notificationId: n.id,
            type: n.type ?? 'manual',
            relatedType: n.related_type ?? undefined,
            relatedId: n.related_id ?? undefined,
          },
        });
      }
    }

    if (dryRun) {
      return Response.json({
        success: true,
        dryRun: true,
        notifications: pending.length,
        messages: messages.length,
      });
    }

    let delivered = 0;
    const errors: string[] = [];
    for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          Accept: 'application/json',
        },
        body: JSON.stringify(batch),
      });
      const json = await res.json().catch(() => null);
      const tickets = Array.isArray(json?.data) ? json.data : [];
      for (const t of tickets) {
        if (t?.status === 'ok') delivered += 1;
        else errors.push(t?.message ?? 'Erreur Expo inconnue');
      }
      if (!tickets.length) errors.push(`HTTP ${res.status}`);
    }

    // Marquage après envoi : en cas d'échec du POST Expo, la notification sera
    // retentée au passage suivant tant qu'elle reste dans la fenêtre.
    for (const n of pending) {
      try {
        await svc.AppNotification.update(n.id, { push_sent: true });
      } catch (err) {
        console.error('Marquage push_sent impossible pour', n.id, err?.message ?? err);
      }
    }

    return Response.json({
      success: true,
      scanned: recent?.length ?? 0,
      notifications: pending.length,
      devices: messages.length,
      delivered,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error('dispatchPushNotifications:', error);
    return Response.json({ error: error?.message ?? String(error) }, { status: 500 });
  }
});
