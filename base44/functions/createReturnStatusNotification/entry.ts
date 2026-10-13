import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Notifie le client quand le statut de sa réclamation (entité `Return`) change.
 *
 * Déclenchée par le Workflow « Notification statut réclamation » (mise à jour
 * d'un `Return`, statut modifié), qui transmet l'identifiant de la réclamation
 * (`entity_id`, comme « Bonus parrainage »). Crée une `AppNotification`
 * ciblée : elle apparaît dans la cloche de l'app et du site, et le Workflow
 * « Push – envoi immédiat » l'envoie aussitôt en notification push.
 *
 * `related_type: 'return'` + `related_id` (la réclamation) : l'app ouvre la
 * réclamation à l'appui. `type: 'manual'` : une ancienne version de l'app,
 * qui ne connaît pas `return`, l'affiche comme une notification simple.
 */

const euro = (n: unknown) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`;
const orderRef = (id: unknown) => (id ? `#${String(id).slice(-8).toUpperCase()}` : '');
/** Dates base44 en UTC sans suffixe (« 2026-10-12T18:24:28.220000 »). */
const serverTime = (s: unknown) =>
  typeof s === 'string' && s ? Date.parse(/(Z|[+-]\d{2}:?\d{2})$/i.test(s) ? s : `${s}Z`) : NaN;
/** Même notification déjà créée il y a moins de 10 min : déclenchement en double. */
const DUPLICATE_WINDOW_MS = 10 * 60_000;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const svc = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));

    // Workflow : `entity_id` en argument ; ancien format d'automatisation :
    // `data` / `changed_fields` / `event.entity_id` à la racine.
    const entityId = body.entity_id || body.event?.entity_id || body.data?.id;
    let data = body.data && typeof body.data === 'object' ? body.data : null;
    if (!data && entityId) data = await svc.Return.get(entityId).catch(() => null);
    const changed: string[] | null = Array.isArray(body.changed_fields) ? body.changed_fields : null;

    if (changed && !changed.includes('status')) {
      return Response.json({ ok: true, skipped: true, reason: 'status_not_changed' });
    }
    if (!data || !data.customer_email) {
      return Response.json({ ok: true, skipped: true, reason: 'no_customer' });
    }
    const returnId = data.id || entityId;

    const ref = orderRef(data.order_id);
    const forOrder = ref ? ` (commande ${ref})` : '';
    const adminMessage = String(data.admin_message ?? '').trim();
    let title: string;
    let message: string;

    switch (data.status) {
      case 'approved':
        title = 'Réclamation acceptée';
        message = [
          data.resolution_type === 'refund_keep'
            ? `Votre réclamation${forOrder} a été acceptée : vous gardez le produit, le remboursement sera crédité sur votre portefeuille AfriGo.`
            : `Votre réclamation${forOrder} a été acceptée : le livreur passera récupérer le produit.`,
          adminMessage,
        ]
          .filter(Boolean)
          .join(' ');
        break;
      case 'completed': {
        const refund = Number(data.refund_amount) || 0;
        const outcome =
          (data.resolution_type === 'refund' || data.resolution_type === 'refund_keep') && refund > 0
            ? ` ${euro(refund)} ont été crédités sur votre portefeuille AfriGo.`
            : data.resolution_type === 'exchange'
              ? ' Votre produit est échangé.'
              : '';
        title = 'Réclamation terminée';
        message = [`Votre réclamation${forOrder} est terminée.${outcome}`, adminMessage]
          .filter(Boolean)
          .join(' ');
        break;
      }
      case 'rejected': {
        const reason = String(data.rejection_reason ?? '').trim();
        title = 'Réclamation refusée';
        message = [`Votre réclamation${forOrder} a été refusée.`, reason ? `Motif : ${reason}` : '']
          .filter(Boolean)
          .join(' ');
        break;
      }
      default:
        // « En attente » : c'est le client qui vient de la déposer.
        return Response.json({ ok: true, skipped: true, reason: `status_${data.status}` });
    }

    const previous = await svc.AppNotification.filter({ related_type: 'return', related_id: returnId }).catch(() => []);
    const duplicate = (previous ?? []).some(
      (n: any) => n?.title === title && Date.now() - serverTime(n?.created_date) < DUPLICATE_WINDOW_MS,
    );
    if (duplicate) {
      return Response.json({ ok: true, skipped: true, reason: 'already_notified' });
    }

    await svc.AppNotification.create({
      title,
      message,
      type: 'manual',
      target_audience: 'specific',
      target_emails: [data.customer_email],
      related_type: 'return',
      related_id: returnId,
    });

    return Response.json({ ok: true, title, message });
  } catch (error) {
    return Response.json({ error: (error as Error)?.message ?? String(error) }, { status: 500 });
  }
}
