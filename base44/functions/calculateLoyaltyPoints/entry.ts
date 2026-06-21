import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const loyaltySettings = await base44.entities.LoyaltySettings.list();
    const settings = loyaltySettings[0];

    if (!settings || !settings.is_active) {
      return Response.json({ points: 0, message: 'Système de fidélité désactivé' });
    }

    const now = new Date();
    let periodStart = new Date();

    if (settings.points_validity_unit === 'days') {
      periodStart.setDate(now.getDate() - settings.points_validity_duration);
    } else if (settings.points_validity_unit === 'weeks') {
      periodStart.setDate(now.getDate() - (settings.points_validity_duration * 7));
    } else if (settings.points_validity_unit === 'months') {
      periodStart.setMonth(now.getMonth() - settings.points_validity_duration);
    }

    const allOrders = await base44.entities.Order.filter({
      customer_email: user.email,
      status: 'delivered'
    });

    const ordersInPeriod = allOrders.filter(order => {
      const deliveredDate = new Date(order.delivered_date);
      return deliveredDate >= periodStart && deliveredDate <= now;
    });

    const totalSpent = ordersInPeriod.reduce((sum, order) => sum + (order.total_amount || 0), 0);

    let points = 0;
    if (totalSpent >= settings.min_purchase_amount) {
      points = Math.floor(totalSpent * settings.points_per_euro);
    }

    const expiresAt = new Date();
    if (settings.points_validity_unit === 'days') {
      expiresAt.setDate(expiresAt.getDate() + settings.points_validity_duration);
    } else if (settings.points_validity_unit === 'weeks') {
      expiresAt.setDate(expiresAt.getDate() + (settings.points_validity_duration * 7));
    } else if (settings.points_validity_unit === 'months') {
      expiresAt.setMonth(expiresAt.getMonth() + settings.points_validity_duration);
    }

    return Response.json({
      points,
      totalSpent,
      periodStart: periodStart.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ordersCount: ordersInPeriod.length
    });

  } catch (error) {
    console.error('Erreur:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});