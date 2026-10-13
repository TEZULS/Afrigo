import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Notifie le client quand un remboursement (entité `Refund`) est effectué.
 *
 * Déclenchée par le Workflow « Notification remboursement effectué »
 * (création ou mise à jour d'un `Refund` qui passe à « effectué »), qui
 * transmet l'identifiant du remboursement (`entity_id`). Une seule
 * notification par remboursement, même si le Workflow se déclenche deux fois.
 * Crée une `AppNotification` ciblée, que le Workflow « Push – envoi immédiat »
 * envoie aussitôt en push.
 *
 * `related_type: 'refund'` : l'app ouvre « Mes remboursements » à l'appui.
 * `type: 'manual'` : une ancienne version de l'app l'affiche simplement.
 */

const euro = (n: unknown) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`;
const orderRef = (id: unknown) => (id ? `#${String(id).slice(-8).toUpperCase()}` : '');

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));

    // Workflow : `entity_id` en argument ; ancien format : `data` / `old_data`.
    const entityId = body.entity_id || body.event?.entity_id || body.data?.id;
    let data = body.data && typeof body.data === 'object' ? body.data : null;
    if (!data && entityId) data = await svc.Refund.get(entityId).catch(() => null);
    const oldData = body.old_data && typeof body.old_data === 'object' ? body.old_data : null;
    const changed: string[] | null = Array.isArray(body.changed_fields) ? body.changed_fields : null;

    if (!data || !data.customer_email) {
      return Response.json({ ok: true, skipped: true, reason: 'no_customer' });
    }
    if (data.status !== 'completed') {
      return Response.json({ ok: true, skipped: true, reason: `status_${data.status}` });
    }
    // Déjà effectué avant cette mise à jour, ou statut inchangé : déjà notifié.
    if (oldData?.status === 'completed' || (changed && changed.length > 0 && !changed.includes('status'))) {
      return Response.json({ ok: true, skipped: true, reason: 'already_completed' });
    }
    const refundId = data.id || entityId;
    const previous = await svc.AppNotification.filter({ related_type: 'refund', related_id: refundId }).catch(() => []);
    if ((previous ?? []).length > 0) {
      return Response.json({ ok: true, skipped: true, reason: 'already_notified' });
    }

    const ref = orderRef(data.order_id);
    const amount = euro(data.amount);
    const where =
      data.refund_method === 'card'
        ? `${amount} ont été remboursés sur votre carte bancaire. Selon votre banque, le crédit apparaît sous quelques jours.`
        : `${amount} ont été crédités sur votre portefeuille AfriGo.`;
    const notes = String(data.admin_notes ?? '').trim();
    const message = [`Remboursement effectué${ref ? ` pour la commande ${ref}` : ''} : ${where}`, notes]
      .filter(Boolean)
      .join(' ');

    await svc.AppNotification.create({
      title: 'Remboursement effectué',
      message,
      type: 'manual',
      target_audience: 'specific',
      target_emails: [data.customer_email],
      related_type: 'refund',
      related_id: refundId,
    });

    return Response.json({ ok: true, message });
  } catch (error) {
    return Response.json({ error: (error as Error)?.message ?? String(error) }, { status: 500 });
  }
}
