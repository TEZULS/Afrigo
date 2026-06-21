import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: order, old_data } = await req.json();

    // Only award points when the order transitions into 'delivered'
    if (event.type !== 'update' || order.status !== 'delivered') {
      return Response.json({ message: 'No action needed' });
    }

    // Guard against repeated updates on an already-delivered order
    if (old_data?.status === 'delivered') {
      return Response.json({ message: 'Already delivered' });
    }

    // Defensive idempotency check in case the transition guard above is bypassed
    const existingPoints = await base44.asServiceRole.entities.LoyaltyPoints.filter({
      order_id: order.id,
      transaction_type: 'earned'
    });
    if (existingPoints.length > 0) {
      return Response.json({ message: 'Points already awarded for this order' });
    }

    const loyaltySettings = await base44.asServiceRole.entities.LoyaltySettings.list();
    const settings = loyaltySettings[0];

    if (!settings || !settings.is_active) {
      return Response.json({ message: 'Loyalty program not active' });
    }

    // Calculer le montant éligible (subtotal + delivery_fee). On reconstitue à
    // partir des items si `total_amount` est manquant/incohérent — protège
    // contre les ordres anciens où le champ n'était pas initialisé.
    const itemsTotal = Array.isArray(order.items)
      ? order.items.reduce((sum: number, it: any) => sum + (Number(it.total_price) || 0), 0)
      : 0;
    const deliveryFee = Number(order.delivery_fee) || 0;
    const eligibleAmount = Math.max(
      Number(order.total_amount) || 0,
      itemsTotal + deliveryFee,
    );

    if (eligibleAmount < settings.min_purchase_amount) {
      return Response.json({ message: 'Order below minimum amount' });
    }

    // Règle métier confirmée : 1€ dépensé = 1 point gagné. La règle est
    // hard-codée ici (indépendante de `settings.points_per_euro`) pour
    // garantir un comportement cohérent même si l'admin modifie le réglage.
    const pointsToAdd = Math.round(eligibleAmount);

    let expiresAt = new Date();
    if (settings.points_validity_unit === 'days') {
      expiresAt.setDate(expiresAt.getDate() + settings.points_validity_duration);
    } else if (settings.points_validity_unit === 'weeks') {
      expiresAt.setDate(expiresAt.getDate() + (settings.points_validity_duration * 7));
    } else if (settings.points_validity_unit === 'months') {
      expiresAt.setMonth(expiresAt.getMonth() + settings.points_validity_duration);
    }

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