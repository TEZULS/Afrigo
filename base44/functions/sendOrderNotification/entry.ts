import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Vérifier l'authentification (client ou admin)
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, customerEmail, customerName, orderNumber, phone, status, deliveryAddress } = await req.json();

    if (!orderId || !customerEmail || !status) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Récupérer le template personnalisé
    const templates = await base44.asServiceRole.entities.NotificationTemplate.filter({ status, is_active: true });
    
    if (templates.length === 0) {
      return Response.json({ error: 'No active template for this status' }, { status: 400 });
    }

    const template = templates[0];

    // Remplacer les variables
    const replaceVariables = (text) => {
      return text
        .replace(/{customer_name}/g, customerName || 'Client')
        .replace(/{order_id}/g, orderId)
        .replace(/{order_number}/g, orderNumber || orderId.slice(-8))
        .replace(/{delivery_address}/g, deliveryAddress || '');
    };

    const subject = replaceVariables(template.subject);
    const body = replaceVariables(template.email_body);
    
    // Envoyer l'email
    await base44.integrations.Core.SendEmail({
      from_name: 'AfriGo',
      to: customerEmail,
      subject: subject,
      body: body
    });

    return Response.json({ 
      success: true, 
      message: 'Email envoyé avec succès'
    });
  } catch (error) {
    console.error('Erreur notification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});