import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const stripeApiKey = Deno.env.get('STRIPE_API_KEY');
    
    if (!stripeApiKey) {
      return Response.json({ 
        configured: false,
        message: 'Clé API Stripe non configurée' 
      });
    }

    const stripe = new Stripe(stripeApiKey);
    const account = await stripe.balance.retrieve();

    return Response.json({ 
      configured: true,
      message: 'Stripe connecté avec succès',
      accountCurrency: account.available[0]?.currency || 'eur'
    });

  } catch (error) {
    return Response.json({ 
      configured: false,
      error: error.message 
    }, { status: 200 });
  }
});