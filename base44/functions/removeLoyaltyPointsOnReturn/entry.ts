import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data: returnData, old_data } = await req.json();

    // Vérifier si le retour vient d'être approuvé
    if (event.type !== 'update' || returnData.status !== 'approved' || old_data?.status === 'approved') {
      return Response.json({ message: 'No action needed' });
    }

    // Récupérer la commande associée
    const orders = await base44.asServiceRole.entities.Order.filter({ id: returnData.order_id });
    if (orders.length === 0) {
      return Response.json({ message: 'Order not found' });
    }

    const order = orders[0];

    // Récupérer les paramètres de fidélité
    const loyaltySettings = await base44.asServiceRole.entities.LoyaltySettings.list();
    const settings = loyaltySettings[0];

    if (!settings || !settings.is_active) {
      return Response.json({ message: 'Loyalty program not active' });
    }

    // Calculer les points à retirer en fonction du montant remboursé
    const pointsToRemove = Math.floor(returnData.refund_amount * settings.points_per_euro);

    if (pointsToRemove > 0) {
      await base44.asServiceRole.entities.LoyaltyPoints.create({
        customer_email: returnData.customer_email,
        points: -pointsToRemove,
        order_id: returnData.order_id,
        transaction_type: 'earned'
      });
    }

    return Response.json({ 
      success: true, 
      pointsRemoved: pointsToRemove,
      customerEmail: returnData.customer_email
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});