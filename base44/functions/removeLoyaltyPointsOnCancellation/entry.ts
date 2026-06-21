import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: order, old_data } = await req.json();

    // Only react to the transition into 'cancelled' from another status
    if (event.type !== 'update' || order.status !== 'cancelled' || old_data?.status === 'cancelled') {
      return Response.json({ message: 'No action needed' });
    }

    const earnedPoints = await base44.asServiceRole.entities.LoyaltyPoints.filter({
      customer_email: order.customer_email,
      order_id: order.id,
      transaction_type: 'earned'
    });

    if (earnedPoints.length === 0) {
      return Response.json({ message: 'No earned points found for this order' });
    }

    const totalEarned = earnedPoints.reduce((sum, p) => sum + (p.points > 0 ? p.points : 0), 0);

    if (totalEarned <= 0) {
      return Response.json({ message: 'No positive points to remove' });
    }

    const alreadyRemoved = await base44.asServiceRole.entities.LoyaltyPoints.filter({
      customer_email: order.customer_email,
      order_id: order.id,
      transaction_type: 'expired'
    });

    const alreadyRemovedTotal = alreadyRemoved.reduce((sum, p) => sum + Math.abs(p.points), 0);

    if (alreadyRemovedTotal >= totalEarned) {
      return Response.json({ message: 'Points already removed for this order' });
    }

    const pointsToRemove = totalEarned - alreadyRemovedTotal;

    // Negative transaction with type 'expired' so the cancellation is traceable
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