import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Vérifier que c'est un événement de mise à jour
    if (event.type !== 'update') {
      return Response.json({ success: true });
    }

    const order = data;
    if (!order || !order.status) {
      return Response.json({ success: true });
    }

    // Récupérer le template pour ce statut
    const templates = await base44.asServiceRole.entities.NotificationTemplate.filter(
      { status: order.status, is_active: true }
    );

    if (!templates || templates.length === 0) {
      return Response.json({ success: true });
    }

    const template = templates[0];

    // Récupérer les infos du client
    const users = await base44.asServiceRole.entities.User.filter(
      { email: order.customer_email }
    );
    const user = users?.[0];

    // Remplacer les variables
    const replaceVariables = (text) => {
      return text
        .replace(/\{\{customer_name\}\}/g, user?.full_name || 'Client')
        .replace(/\{\{order_id\}\}/g, order.id || '')
        .replace(/\{\{order_number\}\}/g, order.id?.slice(0, 8).toUpperCase() || '')
        .replace(/\{\{delivery_address\}\}/g, order.delivery_address || '');
    };

    const subject = replaceVariables(template.subject);
    const body = replaceVariables(template.email_body);

    // Envoyer l'email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: order.customer_email,
      subject: subject,
      body: body
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Erreur:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});