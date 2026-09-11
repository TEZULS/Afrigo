import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, customerEmail, customerName, totalAmount, paymentMethod } = await req.json();

    if (!orderId) {
      return Response.json({ error: 'Missing orderId' }, { status: 400 });
    }

    // `wallet` : commande entièrement réglée avec le portefeuille (mobile) — rien à encaisser.
    const paymentLabel =
      paymentMethod === 'card'
        ? 'Carte bancaire'
        : paymentMethod === 'wallet'
          ? 'Portefeuille (déjà réglé)'
          : 'Paiement à la livraison';

    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });

    await Promise.all(admins.map(admin =>
      base44.integrations.Core.SendEmail({
        from_name: 'AfriGo',
        to: admin.email,
        subject: `🛒 Nouvelle commande en attente - #${orderId.slice(-8)}`,
        body: `Une nouvelle commande vient d'être passée et attend votre traitement.\n\nClient : ${customerName || customerEmail}\nEmail : ${customerEmail}\nMontant : ${Number(totalAmount).toFixed(2)}€\nMode de paiement : ${paymentLabel}\nN° commande : ${orderId}\n\nConnectez-vous à l'interface admin pour traiter cette commande.`
      })
    ));

    return Response.json({ success: true });
  } catch (error) {
    console.error('Erreur notification admins:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});