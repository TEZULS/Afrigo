/**
 * Envoi immédiat d'une notification push, réservé aux admins.
 *
 * Facultatif : toute `AppNotification` créée (formulaire de l'admin compris)
 * part déjà en push grâce au déclencheur de `dispatchPushNotifications`.
 * Cette fonction sert à créer une notification par API, ou à **renvoyer** une
 * notification existante ; l'envoi reste celui de `dispatchPushNotifications`
 * (une seule implémentation : Apple direct / Expo, ciblage, accusés).
 *
 * Nommée `pushAppNotification` et non `sendPushNotification` : ce dernier nom
 * est réservé par base44 (intégration intégrée `Core.SendPushNotification`).
 *
 *  1. Pousser une notification **déjà créée** :
 *       POST /functions/pushAppNotification  { "notificationId": "6a9a8a1d..." }
 *     (ajouter "force": true pour renvoyer une notification déjà poussée)
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
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user: any = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }
    if (!user) return Response.json({ error: 'Connexion requise' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Non autorisé' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const svc = base44.asServiceRole.entities;
    let notificationId: string;

    if (payload?.notificationId) {
      const existing = await svc.AppNotification.get(payload.notificationId).catch(() => null);
      if (!existing) return Response.json({ error: 'Notification introuvable' }, { status: 404 });
      if (existing.push_sent === true && payload?.force !== true) {
        return Response.json(
          { error: 'Notification déjà poussée. Ajoutez "force": true pour la renvoyer.' },
          { status: 409 },
        );
      }
      notificationId = existing.id;
    } else {
      const { title, message, type = 'manual', targetEmails, relatedType, relatedId, imageUrl } =
        payload ?? {};
      if (!title || !message) {
        return Response.json({ error: 'Titre et message requis' }, { status: 400 });
      }
      // E-mails gardés tels que saisis (le fil de l'app les compare à
      // l'identique), dédoublonnés sans tenir compte de la casse.
      const seen = new Set<string>();
      const emails: string[] = [];
      for (const raw of Array.isArray(targetEmails) ? targetEmails : []) {
        if (typeof raw !== 'string' || !raw.includes('@')) continue;
        const email = raw.trim();
        if (seen.has(email.toLowerCase())) continue;
        seen.add(email.toLowerCase());
        emails.push(email);
      }
      const created = await svc.AppNotification.create({
        title,
        message,
        type,
        target_audience: emails.length ? 'specific' : 'all',
        target_emails: emails,
        related_type: relatedType ?? 'none',
        related_id: relatedId ?? null,
        image_url: imageUrl ?? null,
        push_sent: false,
      });
      notificationId = created.id;
    }

    // Nouvelle notification : le déclencheur « création d'AppNotification » de
    // dispatchPushNotifications l'envoie déjà (l'appeler ici ferait doublon).
    if (!payload?.notificationId) {
      return Response.json({ success: true, notificationId, queued: true });
    }

    // Renvoi d'une notification existante : appel direct, avec la session admin.
    const secret = Deno.env.get('PUSH_DISPATCH_SECRET');
    const res = await base44.functions.invoke('dispatchPushNotifications', {
      notificationIds: [notificationId],
      ...(secret ? { cronSecret: secret } : {}),
    });
    const dispatch = res?.data ?? res;

    return Response.json({ success: dispatch?.success !== false, notificationId, dispatch });
  } catch (error) {
    console.error('pushAppNotification:', error);
    return Response.json({ error: error?.message ?? String(error) }, { status: 500 });
  }
});
