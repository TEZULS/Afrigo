import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const loyaltySettings = await base44.asServiceRole.entities.LoyaltySettings.list();
    const settings = loyaltySettings[0];

    if (!settings || !settings.is_active) {
      return Response.json({ message: 'Système de fidélité désactivé' });
    }

    const now = new Date();
    let limitDate = new Date();

    if (settings.points_validity_unit === 'days') {
      limitDate.setDate(now.getDate() - settings.points_validity_duration);
    } else if (settings.points_validity_unit === 'weeks') {
      limitDate.setDate(now.getDate() - (settings.points_validity_duration * 7));
    } else if (settings.points_validity_unit === 'months') {
      limitDate.setMonth(now.getMonth() - settings.points_validity_duration);
    }

    const users = await base44.asServiceRole.entities.User.list();
    let resetCount = 0;

    for (const user of users) {
      const orders = await base44.asServiceRole.entities.Order.filter({
        customer_email: user.email,
        status: 'delivered'
      });

      const hasRecentOrders = orders.some(order => {
        const deliveredDate = new Date(order.delivered_date);
        return deliveredDate >= limitDate;
      });

      if (!hasRecentOrders && user.loyalty_points > 0) {
        await base44.asServiceRole.entities.User.update(user.id, {
          loyalty_points: 0,
          loyalty_points_expire_at: null
        });
        resetCount++;
      }
    }

    return Response.json({
      message: `Points réinitialisés pour ${resetCount} utilisateur(s)`,
      resetCount
    });

  } catch (error) {
    console.error('Erreur:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});