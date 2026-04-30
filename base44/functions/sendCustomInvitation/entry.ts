import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const { email, role } = await req.json();

    if (!email || !role) {
      return Response.json({ error: 'Email et rôle requis' }, { status: 400 });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
    if (existingUsers.length > 0) {
      return Response.json({ error: 'Cet utilisateur existe déjà' }, { status: 400 });
    }

    // Inviter l'utilisateur via Base44
    await base44.users.inviteUser(email, role);

    // Récupérer le domaine de l'app depuis l'URL de la requête
    const url = new URL(req.url);
    const appDomain = url.origin; // Ex: https://votre-domaine.com

    // Envoyer un email de bienvenue personnalisé en français
    const subject = role === 'admin' 
      ? '🎉 Bienvenue sur AfriGo - Votre accès administrateur'
      : '🎉 Bienvenue sur AfriGo - Commencez vos courses !';

    const body = role === 'admin'
      ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #FF8C00; font-size: 48px; margin: 0;">AfriGo</h1>
            <p style="color: #008000; font-size: 20px; margin: 10px 0;">Vos courses fraîches instantanées chez vous</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #FF8C00 0%, #FF6B00 100%); padding: 30px; border-radius: 15px; color: white; margin-bottom: 30px;">
            <h2 style="margin: 0 0 15px 0;">👋 Bienvenue dans l'équipe !</h2>
            <p style="font-size: 16px; line-height: 1.6; margin: 0;">
              Vous avez été invité(e) à rejoindre AfriGo en tant qu'administrateur. 
              Vous allez pouvoir gérer la plateforme et offrir la meilleure expérience à nos clients.
            </p>
          </div>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h3 style="color: #008000; margin-top: 0;">🔑 Vos identifiants</h3>
            <p style="margin: 10px 0;"><strong>Email :</strong> ${email}</p>
            <p style="margin: 10px 0;"><strong>Rôle :</strong> Administrateur</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${appDomain}" style="display: inline-block; background: #008000; color: white; padding: 15px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px;">
              🔐 Se connecter à AfriGo
            </a>
            <p style="color: #666; margin: 20px 0 0 0; font-size: 14px;">
              ou copiez ce lien : <a href="${appDomain}" style="color: #FF8C00;">${appDomain}</a>
            </p>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; margin: 0;">Note : Vous avez également reçu un email de confirmation de Base44</p>
          </div>
        </div>
      `
      : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #FF8C00; font-size: 48px; margin: 0;">AfriGo</h1>
            <p style="color: #008000; font-size: 20px; margin: 10px 0;">Vos courses fraîches instantanées chez vous</p>
          </div>
          
          <div style="background: linear-gradient(135deg, #FF8C00 0%, #FF6B00 100%); padding: 30px; border-radius: 15px; color: white; margin-bottom: 30px;">
            <h2 style="margin: 0 0 15px 0;">🎉 Bienvenue sur AfriGo !</h2>
            <p style="font-size: 16px; line-height: 1.6; margin: 0;">
              Nous sommes ravis de vous compter parmi nous ! Découvrez nos produits frais et profitez de nos offres exclusives.
            </p>
          </div>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h3 style="color: #008000; margin-top: 0;">🎁 Ce qui vous attend :</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">✓ Livraison rapide à domicile</li>
              <li style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">✓ Produits frais et de qualité</li>
              <li style="padding: 10px 0; border-bottom: 1px solid #e0e0e0;">✓ Programme de fidélité avec points bonus</li>
              <li style="padding: 10px 0;">✓ Promotions régulières</li>
            </ul>
          </div>

          <div style="background: #fff3e0; padding: 20px; border-radius: 10px; border-left: 4px solid #FF8C00; margin-bottom: 20px;">
            <p style="margin: 0; color: #666;">
              <strong>💡 Astuce :</strong> Parrainez vos amis et gagnez des bonus sur vos prochaines commandes !
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${appDomain}" style="display: inline-block; background: #FF8C00; color: white; padding: 15px 40px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px;">
              🛒 Commencer mes courses
            </a>
            <p style="color: #666; margin: 20px 0 0 0; font-size: 14px;">
              ou copiez ce lien : <a href="${appDomain}" style="color: #008000;">${appDomain}</a>
            </p>
          </div>

          <div style="text-align: center; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; margin: 0;">Note : Vous avez également reçu un email de confirmation de Base44</p>
          </div>
        </div>
      `;

    await base44.integrations.Core.SendEmail({
      from_name: 'AfriGo',
      to: email,
      subject,
      body
    });

    return Response.json({ 
      success: true, 
      message: `Invitation envoyée à ${email}` 
    });
  } catch (error) {
    console.error('Erreur:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});