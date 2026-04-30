import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2024-12-18.acacia',
});

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { refundId, orderId, amount, reason } = await req.json();

    if (!refundId || !orderId || !amount) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Récupérer la commande pour trouver le payment_intent
    const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId });
    const order = orders[0];

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!order.stripe_payment_intent_id) {
      return Response.json({ error: 'No payment intent found for this order' }, { status: 400 });
    }

    // Créer le remboursement Stripe
    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount: Math.round(amount * 100), // Stripe utilise les centimes
      reason: 'requested_by_customer',
      metadata: {
        order_id: orderId,
        refund_id: refundId,
        admin_email: user.email,
        cancellation_reason: reason
      }
    });

    // Mettre à jour le statut de la demande de remboursement
    await base44.asServiceRole.entities.Refund.update(refundId, {
      status: 'completed',
      admin_notes: `Remboursement Stripe effectué: ${refund.id}`
    });

    return Response.json({
      success: true,
      refund_id: refund.id,
      status: refund.status,
      amount: refund.amount / 100
    });

  } catch (error) {
    console.error('Erreur remboursement:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
});