import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@16.11.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await base44.asServiceRole.entities.AppSettings.list();
    const stripeSecretKey = settings[0]?.stripe_secret_key;

    if (!stripeSecretKey) {
      return Response.json({ error: 'Stripe non configuré.' }, { status: 400 });
    }

    const stripe = new Stripe(stripeSecretKey);

    if (user.saved_payment_method_id) {
      await stripe.paymentMethods.detach(user.saved_payment_method_id);
    }

    await base44.auth.updateMe({
      saved_payment_method_id: null,
      saved_card_info: null,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting card:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});