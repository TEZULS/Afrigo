/**
 * Envoie une notification `AppNotification` sur les téléphones (APNs / FCM via
 * l'API Expo), afin qu'elle s'affiche app fermée ou écran verrouillé.
 *
 * Nommée `pushAppNotification` et non `sendPushNotification` : ce dernier nom
 * est réservé par base44 (intégration intégrée `Core.SendPushNotification`),
 * une fonction ainsi nommée ne peut pas être déployée ni invoquée.
 *
 * Deux usages :
 *
 *  1. Pousser une notification **déjà créée** (par l'admin, le suivi de
 *     livraison, la relance panier…) :
 *       POST /functions/pushAppNotification  { "notificationId": "6a9a8a1d..." }
 *
 *  2. Créer **et** pousser en une fois :
 *       POST /functions/pushAppNotification
 *       {
 *         "title": "Livraison offerte ce week-end",
 *         "message": "Profitez-en jusqu'à dimanche.",
 *         "type": "manual",                  // cf. enum AppNotification.type
 *         "targetEmails": ["client@x.fr"],   // omis => diffusion à tous
 *         "relatedType": "order",            // optionnel
 *         "relatedId": "6a87607f...",        // optionnel
 *         "imageUrl": "https://..."          // optionnel
 *       }
 *
 * Le jeton du device est stocké sur le profil utilisateur (`expo_push_token`)
 * par l'application mobile. Un client sans jeton (app jamais ouverte,
 * notifications refusées) reçoit quand même la notification in-app.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** L'API Expo accepte au maximum 100 messages par requête. */
const EXPO_BATCH_SIZE = 100;
/** Canal Android déclaré par l'app mobile (cf. mob/src/services/pushNotifications.ts). */
const ANDROID_CHANNEL_ID = 'afrigo-default';

const isExpoToken = (token: unknown): token is string =>
  typeof token === 'string' &&
  (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/** Jetons push de tous les destinataires d'une notification. */
async function resolveTokens(base44: any, notification: any) {
  const svc = base44.asServiceRole.entities;

  if (notification.target_audience === 'specific') {
    const emails: string[] = Array.isArray(notification.target_emails)
      ? notification.target_emails
      : [];
    const tokens: string[] = [];
    for (const email of emails) {
      try {
        const found = await svc.User.filter({ email });
        const token = found?.[0]?.expo_push_token;
        if (isExpoToken(token)) tokens.push(token);
      } catch (err) {
        console.error('Profil illisible pour', email, err?.message ?? err);
      }
    }
    return { tokens, audience: emails.length };
  }

  // Diffusion à tous : on pagine la liste des utilisateurs.
  const tokens: string[] = [];
  let skip = 0;
  const limit = 100;
  let audience = 0;
  for (;;) {
    const batch = await svc.User.list(undefined, limit, skip);
    if (!batch?.length) break;
    audience += batch.length;
    for (const u of batch) {
      if (isExpoToken(u?.expo_push_token)) tokens.push(u.expo_push_token);
    }
    if (batch.length < limit) break;
    skip += limit;
  }
  return { tokens, audience };
}

/** Envoie les messages à Expo et renvoie les tickets, dans l'ordre des jetons. */
async function pushToExpo(tokens: string[], notification: any) {
  const messages = tokens.map((to) => ({
    to,
    sound: 'default',
    title: notification.title,
    body: notification.message,
    priority: 'high',
    channelId: ANDROID_CHANNEL_ID,
    data: {
      notificationId: notification.id,
      type: notification.type ?? 'manual',
      relatedType: notification.related_type ?? undefined,
      relatedId: notification.related_id ?? undefined,
    },
  }));

  const tickets: any[] = [];
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
    if (Array.isArray(json?.data)) tickets.push(...json.data);
    else tickets.push(json ?? { status: 'error', message: `HTTP ${res.status}` });
  }
  return tickets;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;

    let notification: any;

    if (payload?.notificationId) {
      notification = await svc.AppNotification.get(payload.notificationId);
      if (!notification) {
        return Response.json({ error: 'Notification introuvable' }, { status: 404 });
      }
    } else {
      const { title, message, type = 'manual', targetEmails, relatedType, relatedId, imageUrl } =
        payload ?? {};

      if (!title || !message) {
        return Response.json({ error: 'Titre et message requis' }, { status: 400 });
      }

      const emails: string[] = Array.from(
        new Set(
          (Array.isArray(targetEmails) ? targetEmails : [])
            .filter((e: unknown): e is string => typeof e === 'string' && e.includes('@'))
            .map((e: string) => e.trim().toLowerCase()),
        ),
      );

      notification = await svc.AppNotification.create({
        title,
        message,
        type,
        target_audience: emails.length ? 'specific' : 'all',
        target_emails: emails,
        related_type: relatedType ?? 'none',
        related_id: relatedId ?? null,
        image_url: imageUrl ?? null,
      });
    }

    const { tokens, audience } = await resolveTokens(base44, notification);
    const tickets = tokens.length ? await pushToExpo(tokens, notification) : [];
    const delivered = tickets.filter((t) => t?.status === 'ok').length;
    const errors = tickets
      .filter((t) => t?.status !== 'ok')
      .map((t) => t?.message ?? 'Erreur Expo inconnue');

    // Trace pour le dispatcher planifié : sans ce champ dans le schéma
    // `AppNotification`, l'écriture est ignorée par base44 (voir HANDOFF § 10.1 bis).
    try {
      await svc.AppNotification.update(notification.id, { push_sent: true });
    } catch {
      /* champ absent du schéma : sans incidence sur l'envoi */
    }

    return Response.json({
      success: true,
      notificationId: notification.id,
      audience,
      devices: tokens.length,
      delivered,
      errors,
    });
  } catch (error) {
    console.error('pushAppNotification:', error);
    return Response.json({ error: error?.message ?? String(error) }, { status: 500 });
  }
});
