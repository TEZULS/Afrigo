import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const APPLE_BUNDLE_ID = 'app.afrigo.mobile';
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

type AppleJwk = { kty: string; kid: string; n: string; e: string };
type OAuthUserResult = { access_token: string; user: { email: string; full_name?: string } };

let appleJwksCache: { keys: AppleJwk[]; fetchedAt: number } | null = null;

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJwtPart(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
}

async function importRsaPublicKey(jwk: AppleJwk): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

async function getAppleJwks(): Promise<AppleJwk[]> {
  const now = Date.now();
  if (appleJwksCache && now - appleJwksCache.fetchedAt < 3_600_000) {
    return appleJwksCache.keys;
  }
  const res = await fetch(APPLE_JWKS_URL);
  if (!res.ok) throw new Error('Impossible de récupérer les clés Apple');
  const data = await res.json();
  appleJwksCache = { keys: data.keys, fetchedAt: now };
  return data.keys;
}

async function verifyAppleIdentityToken(
  identityToken: string,
): Promise<{ sub: string; email?: string }> {
  const parts = identityToken.split('.');
  if (parts.length !== 3) throw new Error('Token Apple invalide');

  const header = decodeJwtPart(parts[0]) as { alg: string; kid: string };
  const payload = decodeJwtPart(parts[1]) as {
    iss: string;
    aud: string;
    exp: number;
    sub: string;
    email?: string;
  };

  if (header.alg !== 'RS256') throw new Error('Algorithme Apple non supporté');
  if (payload.iss !== APPLE_ISSUER) throw new Error('Émetteur Apple invalide');
  if (payload.aud !== APPLE_BUNDLE_ID) throw new Error('Audience Apple invalide');
  if (payload.exp * 1000 < Date.now()) throw new Error('Token Apple expiré');

  const keys = await getAppleJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Clé Apple introuvable');

  const key = await importRsaPublicKey(jwk);
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = base64UrlDecode(parts[2]);

  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  if (!valid) throw new Error('Signature Apple invalide');

  return { sub: payload.sub, email: payload.email };
}

function getGoogleClientIds(): string[] {
  const raw = [
    Deno.env.get('GOOGLE_CLIENT_IDS'),
    Deno.env.get('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'),
    Deno.env.get('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'),
    Deno.env.get('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID'),
    Deno.env.get('EXPO_PUBLIC_GOOGLE_CLIENT_ID'),
  ]
    .filter(Boolean)
    .flatMap((value) => value!.split(',').map((id) => id.trim()))
    .filter(Boolean);

  return [...new Set(raw)];
}

async function verifyGoogleIdToken(
  idToken: string,
): Promise<{ email: string; name?: string; sub: string }> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );
  if (!res.ok) throw new Error('Token Google invalide');

  const data = await res.json();
  if (data.error || data.error_description) {
    throw new Error(data.error_description || data.error);
  }

  const allowedAudiences = getGoogleClientIds();
  if (allowedAudiences.length > 0 && !allowedAudiences.includes(data.aud)) {
    throw new Error('Audience Google invalide');
  }

  const emailVerified = data.email_verified === true || data.email_verified === 'true';
  if (!emailVerified) throw new Error('Email Google non vérifié');
  if (!data.email) throw new Error('Email Google manquant');

  return { email: data.email, name: data.name, sub: data.sub };
}

async function findOrCreateOAuthUser(
  base44: ReturnType<typeof createClientFromRequest>,
  email: string,
  fullName?: string,
): Promise<OAuthUserResult> {
  let users = await base44.asServiceRole.entities.User.filter({ email });

  if (users.length === 0) {
    await base44.asServiceRole.users.inviteUser(email, 'user');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    users = await base44.asServiceRole.entities.User.filter({ email });
  }

  if (users.length === 0) {
    throw new Error('Utilisateur non créé');
  }

  const user = users[0];
  let resolvedFullName = user.full_name;

  if (fullName && !user.full_name) {
    await base44.asServiceRole.entities.User.update(user.id, { full_name: fullName });
    resolvedFullName = fullName;
  }

  const { access_token } = await base44.asServiceRole.sso.getAccessToken(user.id);
  return {
    access_token,
    user: { email: user.email, full_name: resolvedFullName },
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, email, password, phone } = body;

    if (action === 'check_exists') {
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
        await base44.asServiceRole.users.inviteUser(email, 'user');

        // Wait for user creation to propagate before updating
        await new Promise(resolve => setTimeout(resolve, 2000));

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

    if (action === 'apple_login') {
      const { identityToken, fullName, email: payloadEmail } = body;
      if (!identityToken) {
        return Response.json({ error: 'identityToken requis' }, { status: 400 });
      }

      try {
        const claims = await verifyAppleIdentityToken(identityToken);
        const resolvedEmail = claims.email || payloadEmail;
        if (!resolvedEmail) {
          return Response.json({ error: 'Email requis' }, { status: 400 });
        }

        const result = await findOrCreateOAuthUser(base44, resolvedEmail, fullName);
        return Response.json(result);
      } catch (error) {
        console.error('Erreur apple_login:', error);
        return Response.json({ error: error.message }, { status: 401 });
      }
    }

    if (action === 'google_login') {
      const { idToken } = body;
      if (!idToken) {
        return Response.json({ error: 'idToken requis' }, { status: 400 });
      }

      try {
        const claims = await verifyGoogleIdToken(idToken);
        const result = await findOrCreateOAuthUser(base44, claims.email, claims.name);
        return Response.json(result);
      } catch (error) {
        console.error('Erreur google_login:', error);
        return Response.json({ error: error.message }, { status: 401 });
      }
    }

    if (action === 'reset_password') {
      const users = await base44.asServiceRole.entities.User.list();
      const user = users.find(u => u.email === email);
      
      if (!user) {
        return Response.json({ success: false, error: 'Aucun compte trouvé avec cet email' });
      }

      const resetToken = crypto.randomUUID();
      const resetExpiry = new Date(Date.now() + 3600000).toISOString(); // 1h validity

      await base44.asServiceRole.entities.User.update(user.id, {
        reset_token: resetToken,
        reset_token_expiry: resetExpiry
      });

      // Use referer header to derive the app URL for the reset link
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
      const { token } = body;
      const users = await base44.asServiceRole.entities.User.list();
      const user = users.find(u => u.reset_token === token && new Date(u.reset_token_expiry) > new Date());
      
      if (user) {
        return Response.json({ success: true, email: user.email });
      } else {
        return Response.json({ success: false, error: 'Lien invalide ou expiré' });
      }
    }

    if (action === 'update_password') {
      const { token, newPassword } = body;
      const users = await base44.asServiceRole.entities.User.list();
      const user = users.find(u => u.reset_token === token && new Date(u.reset_token_expiry) > new Date());
      
      if (!user) {
        return Response.json({ success: false, error: 'Lien invalide ou expiré' });
      }

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

      const userEmail = user.email;

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
