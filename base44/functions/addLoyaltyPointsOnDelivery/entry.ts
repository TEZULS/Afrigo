import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: order, old_data } = await req.json();

    // Vérifier si le statut vient de passer à "delivered" (confirmé à la livraison)
    // Ne pas ajouter les points si le statut est "confirmed" ou autre
    if (event.type !== 'update' || order.status !== 'delivered') {
      return Response.json({ message: 'No action needed' });
    }
    
    // Vérifier que ce n'est pas un update multiple (éviter la duplication)
    if (old_data?.status === 'delivered') {
      return Response.json({ message: 'Already delivered' });
    }

    // Vérifier si des points ont déjà été attribués pour cette commande (évite la duplication)
    const existingPoints = await base44.asServiceRole.entities.LoyaltyPoints.filter({
      order_id: order.id,
      transaction_type: 'earned'
    });
    if (existingPoints.length > 0) {
      return Response.json({ message: 'Points already awarded for this order' });
    }

    // Récupérer les paramètres de fidélité
    const loyaltySettings = await base44.asServiceRole.entities.LoyaltySettings.list();
    const settings = loyaltySettings[0];

    if (!settings || !settings.is_active) {
      return Response.json({ message: 'Loyalty program not active' });
    }

    // Vérifier le montant minimum
    if (order.total_amount < settings.min_purchase_amount) {
      return Response.json({ message: 'Order below minimum amount' });
    }

    // Calculer les points à attribuer : 1 point par euro dépensé (égal au montant arrondi)
    // points_per_euro doit être 1 pour garantir commande 20€ = 20 points
    const pointsToAdd = Math.floor(order.total_amount);

    // Calculer la date d'expiration
    let expiresAt = new Date();
    if (settings.points_validity_unit === 'days') {
      expiresAt.setDate(expiresAt.getDate() + settings.points_validity_duration);
    } else if (settings.points_validity_unit === 'weeks') {
      expiresAt.setDate(expiresAt.getDate() + (settings.points_validity_duration * 7));
    } else if (settings.points_validity_unit === 'months') {
      expiresAt.setMonth(expiresAt.getMonth() + settings.points_validity_duration);
    }

    // Créer la transaction de points
    await base44.asServiceRole.entities.LoyaltyPoints.create({
      customer_email: order.customer_email,
      points: pointsToAdd,
      order_id: order.id,
      transaction_type: 'earned',
      expires_at: expiresAt.toISOString().split('T')[0]
    });

    return Response.json({ 
      success: true, 
      pointsAdded: pointsToAdd,
      customerEmail: order.customer_email,
      orderId: order.id
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});