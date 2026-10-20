import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const cartItems = await base44.asServiceRole.entities.CartItem.list();

    // Charger les paramètres de rappel de panier personnalisables par l'admin
    const settingsList = await base44.asServiceRole.entities.CartReminderSettings.list();
    const s = settingsList[0] || {};
    if (s.enabled === false) {
      return Response.json({ ok: true, created: 0, checked: 0, disabled: true });
    }
    const idleThresholdMs = (s.idle_threshold_hours ?? 24) * 60 * 60 * 1000;
    const antiSpamMs = (s.anti_spam_hours ?? 4) * 60 * 60 * 1000;
    const crTitle = s.title || '🛒 Vous avez oublié votre panier !';
    const crMessageTpl = s.message || 'Il semble que vous ayez laissé {count} article(s) dans votre panier. Revenez finaliser votre commande avant qu\'il ne soit trop tard !';
    const crImageUrl = s.image_url || null;

    // Paramètres de rappel de stock faible
    const lowStockEnabled = s.low_stock_enabled !== false;
    const lowStockThreshold = s.low_stock_threshold ?? 5;
    const lowStockTitle = s.low_stock_title || '⚠️ Un article de votre panier est bientôt en rupture !';
    const lowStockMessageTpl = s.low_stock_message || 'Le produit "{product}" dans votre panier ne dispose plus que de {stock} unité(s) en stock. Commandez vite avant qu\'il ne soit trop tard !';
    const lowStockImageUrl = s.low_stock_image_url || crImageUrl;

    const now = Date.now();

    // Grouper les paniers par client
    const cartsByCustomer = new Map();
    for (const item of cartItems) {
      if (!item.customer_email) continue;
      if (!cartsByCustomer.has(item.customer_email)) {
        cartsByCustomer.set(item.customer_email, { items: [], lastUpdated: 0 });
      }
      const entry = cartsByCustomer.get(item.customer_email);
      entry.items.push(item);
      const updated = new Date(item.updated_date || item.created_date).getTime();
      if (updated > entry.lastUpdated) entry.lastUpdated = updated;
    }

    // Charger les produits pour vérifier les stocks
    const products = await base44.asServiceRole.entities.Product.list();
    const productMap = new Map();
    for (const p of products) {
      productMap.set(p.id, p);
    }

    let created = 0;
    let lowStockCreated = 0;
    for (const [email, cart] of cartsByCustomer) {
      const idleMs = now - cart.lastUpdated;

      // 1. Rappel d'inactivité (panier abandonné depuis le délai configuré)
      if (idleMs >= idleThresholdMs) {
        const existing = await base44.asServiceRole.entities.AppNotification.filter({
          related_id: email,
          type: 'cart_reminder'
        });
        const hasRecent = existing.some(n => {
          const age = now - new Date(n.created_date).getTime();
          return age < antiSpamMs;
        });
        if (!hasRecent) {
          const itemCount = cart.items.length;
          const message = crMessageTpl.replace(/\{count\}/g, String(itemCount));
          await base44.asServiceRole.entities.AppNotification.create({
            title: crTitle,
            message,
            image_url: crImageUrl,
            type: 'cart_reminder',
            target_audience: 'specific',
            target_emails: [email],
            related_id: email,
            related_type: 'cart'
          });
          created++;
        }
      }

      // 2. Rappel de stock faible sur un produit du panier
      if (lowStockEnabled) {
        const lowStockItems = cart.items.filter(item => {
          const product = productMap.get(item.product_id);
          if (!product) return false;
          const stock = product.stock_quantity ?? 0;
          return stock > 0 && stock <= lowStockThreshold;
        });
        if (lowStockItems.length > 0) {
          const lowStockKey = `lowstock:${email}`;
          const existingLow = await base44.asServiceRole.entities.AppNotification.filter({
            related_id: lowStockKey,
            type: 'cart_reminder'
          });
          const hasRecentLow = existingLow.some(n => {
            const age = now - new Date(n.created_date).getTime();
            return age < antiSpamMs;
          });
          if (!hasRecentLow) {
            // Prendre le produit le plus critique (stock le plus bas)
            const critical = lowStockItems
              .map(item => ({ item, product: productMap.get(item.product_id) }))
              .sort((a, b) => (a.product.stock_quantity ?? 0) - (b.product.stock_quantity ?? 0))[0];
            const product = critical.product;
            const message = lowStockMessageTpl
              .replace(/\{product\}/g, product.name || 'ce produit')
              .replace(/\{stock\}/g, String(product.stock_quantity ?? 0));
            await base44.asServiceRole.entities.AppNotification.create({
              title: lowStockTitle,
              message,
              image_url: lowStockImageUrl,
              type: 'cart_reminder',
              target_audience: 'specific',
              target_emails: [email],
              related_id: lowStockKey,
              related_type: 'cart'
            });
            lowStockCreated++;
          }
        }
      }
    }

    return Response.json({ ok: true, created, lowStockCreated, checked: cartsByCustomer.size });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}