import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@16.11.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, orderData, useSavedCard, orderId, saveCard } = await req.json();

    const settings = await base44.asServiceRole.entities.AppSettings.list();
    const stripeSecretKey = settings[0]?.stripe_secret_key;

    if (!stripeSecretKey) {
      return Response.json({ 
        error: 'Stripe non configuré. Veuillez configurer les clés Stripe dans les paramètres.' 
      }, { status: 400 });
    }

    const stripe = new Stripe(stripeSecretKey);

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || user.email,
      });
      customerId = customer.id;
      await base44.auth.updateMe({ stripe_customer_id: customerId });
    }

    const piOptions = {
      amount: Math.round(amount * 100),
      currency: 'eur',
      customer: customerId,
      metadata: {
        customer_email: user.email,
        customer_name: user.full_name || user.email,
        order_id: orderId || ''
      },
    };

    if (useSavedCard && user.saved_payment_method_id) {
      piOptions.payment_method = user.saved_payment_method_id;
      piOptions.confirm = true;
      piOptions.off_session = true;
    } else if (saveCard) {
      // Persist the payment method on Stripe so the user can reuse it later
      piOptions.setup_future_usage = 'off_session';
      piOptions.automatic_payment_methods = { enabled: true };
    } else {
      piOptions.automatic_payment_methods = { enabled: true };
    }

    const paymentIntent = await stripe.paymentIntents.create(piOptions);

    return Response.json({ 
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});