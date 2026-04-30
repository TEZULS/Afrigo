import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: order, old_data } = await req.json();

    // Vérifier si la commande vient d'être annulée (depuis n'importe quel statut)
    if (event.type !== 'update' || order.status !== 'cancelled' || old_data?.status === 'cancelled') {
      return Response.json({ message: 'No action needed' });
    }

    // Récupérer les points gagnés pour cette commande
    const earnedPoints = await base44.asServiceRole.entities.LoyaltyPoints.filter({
      customer_email: order.customer_email,
      order_id: order.id,
      transaction_type: 'earned'
    });

    if (earnedPoints.length === 0) {
      return Response.json({ message: 'No earned points found for this order' });
    }

    // Calculer le total des points gagnés (positifs seulement)
    const totalEarned = earnedPoints.reduce((sum, p) => sum + (p.points > 0 ? p.points : 0), 0);

    if (totalEarned <= 0) {
      return Response.json({ message: 'No positive points to remove' });
    }

    // Vérifier si des points de retrait ont déjà été créés pour cette commande
    const alreadyRemoved = await base44.asServiceRole.entities.LoyaltyPoints.filter({
      customer_email: order.customer_email,
      order_id: order.id,
      transaction_type: 'expired'
    });

    // Calculer ce qui a déjà été retiré
    const alreadyRemovedTotal = alreadyRemoved.reduce((sum, p) => sum + Math.abs(p.points), 0);

    if (alreadyRemovedTotal >= totalEarned) {
      return Response.json({ message: 'Points already removed for this order' });
    }

    const pointsToRemove = totalEarned - alreadyRemovedTotal;

    // Créer une transaction négative avec type 'expired' pour tracer l'annulation
    await base44.asServiceRole.entities.LoyaltyPoints.create({
      customer_email: order.customer_email,
      points: -pointsToRemove,
      order_id: order.id,
      transaction_type: 'expired'
    });

    return Response.json({ 
      success: true, 
      pointsRemoved: pointsToRemove,
      customerEmail: order.customer_email,
      orderId: order.id,
      previousStatus: old_data?.status
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});