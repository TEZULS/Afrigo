import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Notifie le client quand le statut de sa réclamation (entité `Return`) change.
 *
 * Déclenchée par le Workflow « Notification statut réclamation » (mise à jour
 * d'un `Return`, statut modifié). Crée une `AppNotification` ciblée : elle
 * apparaît dans la cloche de l'app et du site, et le Workflow « Push – envoi
 * immédiat » l'envoie aussitôt en notification push sur le téléphone.
 *
 * `related_type: 'return'` + `related_id` (la réclamation) : l'app ouvre la
 * réclamation à l'appui. `type: 'manual'` : une ancienne version de l'app,
 * qui ne connaît pas `return`, l'affiche comme une notification simple.
 */

const euro = (n: unknown) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`;
const orderRef = (id: unknown) => (id ? `#${String(id).slice(-8).toUpperCase()}` : '');

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const data = body.data;
    const changed: string[] = body.changed_fields || [];

    if (!changed.includes('status')) {
      return Response.json({ ok: true, skipped: true, reason: 'status_not_changed' });
    }
    if (!data || !data.customer_email) {
      return Response.json({ ok: true, skipped: true, reason: 'no_customer' });
    }

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

    await base44.asServiceRole.entities.AppNotification.create({
      title,
      message,
      type: 'manual',
      target_audience: 'specific',
      target_emails: [data.customer_email],
      related_type: 'return',
      related_id: data.id || body.event?.entity_id,
    });

    return Response.json({ ok: true, title, message });
  } catch (error) {
    return Response.json({ error: (error as Error)?.message ?? String(error) }, { status: 500 });
  }
}