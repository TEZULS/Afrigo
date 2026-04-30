import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action, email, password, phone } = await req.json();

    if (action === 'check_exists') {
      // Vérifier si email ou téléphone existe déjà
      const users = await base44.asServiceRole.entities.User.list();
      const emailExists = users.find(u => u.email === email);
      const phoneExists = phone ? users.find(u => u.phone === phone) : null;
      
      return Response.json({ 
        emailExists: !!emailExists,
        phoneExists: !!phoneExists,
        user: emailExists || phoneExists || null
      });
    }

    if (action === 'verify_login') {
      // Vérifier les identifiants
      const users = await base44.asServiceRole.entities.User.list();
      const user = users.find(u => u.email === email && u.user_password === password);
      
      if (user) {
        return Response.json({ 
          success: true,
          user: {
            email: user.email,
            full_name: user.full_name,
            first_name: user.first_name,
            last_name: user.last_name
          }
        });
      } else {
        return Response.json({ success: false, error: 'Email ou mot de passe incorrect' });
      }
    }

    if (action === 'create_user') {
      const { password, civility, first_name, last_name, phone, address, postal_code, city } = body;
      
      try {
        // Inviter l'utilisateur via Base44
        await base44.asServiceRole.users.inviteUser(email, 'user');
        
        // Attendre que l'utilisateur soit créé
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Récupérer et mettre à jour l'utilisateur
        const users = await base44.asServiceRole.entities.User.filter({ email });
        if (users.length > 0) {
          await base44.asServiceRole.entities.User.update(users[0].id, {
            civility,
            first_name,
            last_name,
            full_name: `${first_name} ${last_name}`,
            phone,
            address: address || '',
            postal_code: postal_code || '',
            city: city || '',
            user_password: password
          });
          
          return Response.json({ success: true });
        } else {
          return Response.json({ success: false, error: 'Utilisateur non créé' });
        }
      } catch (error) {
        console.error('Erreur création utilisateur:', error);
        return Response.json({ success: false, error: error.message });
      }
    }

    if (action === 'reset_password') {
      // Envoyer email de réinitialisation
      const users = await base44.asServiceRole.entities.User.list();
      const user = users.find(u => u.email === email);
      
      if (!user) {
        return Response.json({ success: false, error: 'Aucun compte trouvé avec cet email' });
      }

      // Générer un token temporaire
      const resetToken = crypto.randomUUID();
      const resetExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 heure
      
      // Sauvegarder le token
      await base44.asServiceRole.entities.User.update(user.id, {
        reset_token: resetToken,
        reset_token_expiry: resetExpiry
      });

      // Envoyer l'email - Utiliser le header referer pour obtenir l'URL de l'application
      const appUrl = req.headers.get('referer') || req.headers.get('origin') || 'https://early-mole-23-jarewja5r0va.base44.app';
      const baseUrl = appUrl.split('?')[0].replace(/\/$/, '').replace(/\/[^\/]*$/, '');
      const resetLink = `${baseUrl}/Profile?reset=${resetToken}`;
      
      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: 'AfriGo',
        to: email,
        subject: 'Réinitialisation de votre mot de passe - AfriGo',
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF8C00;">Réinitialisation de mot de passe</h2>
            <p>Bonjour ${user.first_name || ''},</p>
            <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
            <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background: #008000; color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; display: inline-block;">
                Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="color: #666; font-size: 14px;">Ce lien est valable pendant 1 heure.</p>
            <p style="color: #666; font-size: 14px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px;">AfriGo - Vos courses fraîches livrées chez vous</p>
          </div>
        `
      });

      return Response.json({ success: true, message: 'Email de réinitialisation envoyé' });
    }

    if (action === 'verify_reset_token') {
      const { token } = await req.json();
      const users = await base44.asServiceRole.entities.User.list();
      const user = users.find(u => u.reset_token === token && new Date(u.reset_token_expiry) > new Date());
      
      if (user) {
        return Response.json({ success: true, email: user.email });
      } else {
        return Response.json({ success: false, error: 'Lien invalide ou expiré' });
      }
    }

    if (action === 'update_password') {
      const { token, newPassword } = await req.json();
      const users = await base44.asServiceRole.entities.User.list();
      const user = users.find(u => u.reset_token === token && new Date(u.reset_token_expiry) > new Date());
      
      if (!user) {
        return Response.json({ success: false, error: 'Lien invalide ou expiré' });
      }

      // Mettre à jour le mot de passe
      await base44.asServiceRole.entities.User.update(user.id, {
        user_password: newPassword,
        reset_token: null,
        reset_token_expiry: null
      });

      return Response.json({ success: true, message: 'Mot de passe mis à jour avec succès' });
    }

    if (action === 'delete_account') {
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ success: false, error: 'Non authentifié' }, { status: 401 });
      }

      // Supprimer toutes les données liées au compte
      const userEmail = user.email;

      // Supprimer les entités liées
      const [cartItems, messages, loyaltyPoints, walletTransactions, orders, returns, reviews, promoCodes, freeProductClaims] = await Promise.all([
        base44.asServiceRole.entities.CartItem.filter({ customer_email: userEmail }),
        base44.asServiceRole.entities.Message.filter({ customer_email: userEmail }),
        base44.asServiceRole.entities.LoyaltyPoints.filter({ customer_email: userEmail }),
        base44.asServiceRole.entities.WalletTransaction.filter({ customer_email: userEmail }),
        base44.asServiceRole.entities.Order.filter({ customer_email: userEmail }),
        base44.asServiceRole.entities.Return.filter({ customer_email: userEmail }),
        base44.asServiceRole.entities.Review.filter({ customer_email: userEmail }),
        base44.asServiceRole.entities.PromoCode.filter({ owner_email: userEmail }),
        base44.asServiceRole.entities.FreeProductClaim.filter({ customer_email: userEmail }),
      ]);

      await Promise.all([
        ...cartItems.map(i => base44.asServiceRole.entities.CartItem.delete(i.id)),
        ...messages.map(i => base44.asServiceRole.entities.Message.delete(i.id)),
        ...loyaltyPoints.map(i => base44.asServiceRole.entities.LoyaltyPoints.delete(i.id)),
        ...walletTransactions.map(i => base44.asServiceRole.entities.WalletTransaction.delete(i.id)),
        ...returns.map(i => base44.asServiceRole.entities.Return.delete(i.id)),
        ...reviews.map(i => base44.asServiceRole.entities.Review.delete(i.id)),
        ...promoCodes.map(i => base44.asServiceRole.entities.PromoCode.delete(i.id)),
        ...freeProductClaims.map(i => base44.asServiceRole.entities.FreeProductClaim.delete(i.id)),
      ]);

      // Supprimer l'utilisateur lui-même
      const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
      if (users.length > 0) {
        await base44.asServiceRole.entities.User.delete(users[0].id);
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Action non reconnue' }, { status: 400 });
    
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});