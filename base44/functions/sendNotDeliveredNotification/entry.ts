import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { orderId, customerEmail, reason } = await req.json();

    if (!orderId || !customerEmail || !reason) {
      return Response.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId });
    const order = orders[0];

    if (!order) {
      return Response.json({ error: 'Commande introuvable' }, { status: 404 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email: customerEmail });
    const customer = users[0];

    const customerName = customer?.first_name || customer?.full_name || 'Client';
    const orderNumber = orderId.slice(-8).toUpperCase();

    const emailBody = `
Bonjour ${customerName},

Nous vous informons que votre commande #${orderNumber} n'a pas pu être livrée.

Motif : ${reason}

Détails de la commande :
- Montant : ${order.total_amount.toFixed(2)}€
- Adresse : ${order.delivery_address}, ${order.delivery_postal_code} ${order.delivery_city}

Nous vous invitons à nous contacter pour organiser une nouvelle livraison ou un remboursement.

Cordialement,
L'équipe AfriGo
    `.trim();

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: customerEmail,
      subject: `⚠️ Votre commande #${orderNumber} n'a pas été livrée`,
      body: emailBody
    });

    // SMS placeholder: until a provider (Twilio/Vonage/…) is wired up, send the
    // SMS body as an email tagged "[SMS]" so the message is still delivered.
    const smsMessage = `AfriGo: Votre commande #${orderNumber} n'a pas été livrée. Motif: ${reason}. Contactez-nous pour plus d'infos.`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: customerEmail,
      subject: `[SMS] Commande #${orderNumber} non livrée`,
      body: smsMessage
    });

    return Response.json({ 
      success: true,
      message: 'Notifications envoyées avec succès'
    });

  } catch (error) {
    console.error('Erreur:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});