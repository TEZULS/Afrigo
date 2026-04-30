import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@16.11.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentMethodId } = await req.json();

    const settings = await base44.asServiceRole.entities.AppSettings.list();
    const stripeSecretKey = settings[0]?.stripe_secret_key;

    if (!stripeSecretKey) {
      return Response.json({ error: 'Stripe non configuré.' }, { status: 400 });
    }

    const stripe = new Stripe(stripeSecretKey);

    // Récupérer ou créer un customer Stripe pour cet utilisateur
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || user.email,
      });
      customerId = customer.id;
      await base44.auth.updateMe({ stripe_customer_id: customerId });
    }

    // Attacher le paymentMethod au customer (ignorer si déjà attaché)
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    } catch (attachErr) {
      // Déjà attaché à ce customer, on continue
      if (!attachErr.message?.includes('already been attached')) throw attachErr;
    }

    // Définir comme moyen de paiement par défaut
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Récupérer les détails de la carte pour affichage
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    const cardInfo = {
      last4: pm.card.last4,
      brand: pm.card.brand,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
    };

    // Sauvegarder l'ID du paymentMethod sur le profil utilisateur
    await base44.auth.updateMe({
      saved_payment_method_id: paymentMethodId,
      saved_card_info: JSON.stringify(cardInfo),
    });

    return Response.json({ success: true, cardInfo });
  } catch (error) {
    console.error('Error saving card:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});