import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@16.11.0';

const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY'));
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  try {
    // Vérifier que c'est une requête POST
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    // Obtenir la signature et le body
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    if (!signature || !webhookSecret) {
      return Response.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    // Valider la signature (IMPORTANT: faire avant d'initialiser base44.auth)
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return Response.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    // Maintenant initialiser Base44 avec l'authentification
    const base44 = createClientFromRequest(req);

    // Traiter selon le type d'événement
    switch (event.type) {
      case 'payment_intent.succeeded': {
        await handlePaymentSucceeded(event.data.object, base44);
        break;
      }
      case 'payment_intent.payment_failed': {
        await handlePaymentFailed(event.data.object, base44);
        break;
      }
      case 'charge.refunded': {
        await handleRefund(event.data.object, base44);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handlePaymentSucceeded(paymentIntent, base44) {
  try {
    const { metadata } = paymentIntent;
    const orderId = metadata?.order_id;
    const customerEmail = metadata?.customer_email;

    if (!orderId) {
      console.log('No order_id in payment metadata');
      return;
    }

    // Récupérer la commande
    const order = await base44.asServiceRole.entities.Order.filter({ id: orderId });
    if (!order || order.length === 0) {
      console.error(`Order not found: ${orderId}`);
      return;
    }

    // Mettre à jour le statut de la commande
    await base44.asServiceRole.entities.Order.update(orderId, {
      status: 'confirmed',
      payment_method: 'card',
      payment_status: 'completed'
    });

    // Envoyer une notification au client
    if (customerEmail) {
      await base44.integrations.Core.SendEmail({
        to: customerEmail,
        subject: '✅ Paiement confirmé - AfriGo',
        body: `Votre paiement de ${paymentIntent.amount / 100}€ a été confirmé. Votre commande est en cours de préparation.`
      });
    }

    // Notifier tous les admins
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    for (const admin of admins) {
      await base44.integrations.Core.SendEmail({
        to: admin.email,
        subject: `🛒 Nouvelle commande par carte - #${orderId.slice(-8)}`,
        body: `Une nouvelle commande a été payée par carte bancaire.\n\nClient: ${customerEmail}\nMontant: ${paymentIntent.amount / 100}€\nCommande ID: ${orderId}\n\nConnectez-vous à l'interface admin pour traiter cette commande.`
      });
    }

    console.log(`Payment succeeded for order: ${orderId}`);
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(paymentIntent, base44) {
  try {
    const { metadata } = paymentIntent;
    const orderId = metadata?.order_id;
    const customerEmail = metadata?.customer_email;

    if (!orderId) {
      console.log('No order_id in payment metadata');
      return;
    }

    // Mettre à jour le statut de la commande avec raison d'échec
    const failureReason = paymentIntent.last_payment_error?.message || 'Raison inconnue';
    await base44.asServiceRole.entities.Order.update(orderId, {
      payment_status: 'failed',
      payment_failure_reason: failureReason
    });

    // Envoyer une notification au client
    if (customerEmail) {
      await base44.integrations.Core.SendEmail({
        to: customerEmail,
        subject: '❌ Paiement échoué - AfriGo',
        body: `Votre paiement n'a pas pu être traité: ${failureReason}. Veuillez réessayer ou contacter notre support.`
      });
    }

    console.log(`Payment failed for order: ${orderId}, reason: ${failureReason}`);
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleRefund(charge, base44) {
  try {
    const { metadata, refunded, amount_refunded } = charge;
    const orderId = metadata?.order_id;
    const customerEmail = metadata?.customer_email;

    if (!orderId || !refunded) {
      console.log('No order_id or charge not refunded');
      return;
    }

    // Créer une transaction de remboursement
    if (customerEmail) {
      await base44.asServiceRole.entities.WalletTransaction.create({
        customer_email: customerEmail,
        amount: amount_refunded / 100,
        type: 'credit',
        reason: `Remboursement de commande #${orderId}`,
        admin_email: 'stripe@webhook'
      });

      // Envoyer une notification au client
      await base44.integrations.Core.SendEmail({
        to: customerEmail,
        subject: '💰 Remboursement traité - AfriGo',
        body: `Un remboursement de ${amount_refunded / 100}€ a été traité pour la commande #${orderId}.`
      });
    }

    console.log(`Refund processed for order: ${orderId}, amount: ${amount_refunded / 100}€`);
  } catch (error) {
    console.error('Error handling refund:', error);
  }
}