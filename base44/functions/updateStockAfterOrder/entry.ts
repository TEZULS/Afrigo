import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function convertToStockUnit(quantity, fromUnit, stockUnit) {
  if (!fromUnit || !stockUnit) return quantity;

  const fromLower = fromUnit.toLowerCase().trim();
  const stockLower = stockUnit.toLowerCase().trim();

  if (fromLower === stockLower) return quantity;

  const weightUnits = { 'g': 1, 'gramme': 1, 'grammes': 1, 'kg': 1000, 'kilo': 1000, 'kilogramme': 1000, 'kilogrammes': 1000 };
  const volumeUnits = { 'ml': 1, 'millilitre': 1, 'millilitres': 1, 'cl': 10, 'dl': 100, 'litre': 1000, 'litres': 1000, 'l': 1000 };

  if (weightUnits[fromLower] && weightUnits[stockLower]) {
    return (quantity * weightUnits[fromLower]) / weightUnits[stockLower];
  }
  if (volumeUnits[fromLower] && volumeUnits[stockLower]) {
    return (quantity * volumeUnits[fromLower]) / volumeUnits[stockLower];
  }

  return quantity;
}

// Parses values like "500g", "1kg", "2 litres" into { amount, unit }.
function parseVariantValue(value) {
  if (!value) return null;
  const match = value.match(/^([\d.,]+)\s*([a-zA-Zéè]+)$/);
  if (!match) return null;
  return { amount: parseFloat(match[1].replace(',', '.')), unit: match[2] };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { orderId } = await req.json();

    if (!orderId) {
      return Response.json({ error: 'Order ID requis' }, { status: 400 });
    }

    const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId });
    const order = orders[0];

    if (!order) {
      return Response.json({ error: 'Commande non trouvée' }, { status: 404 });
    }

    for (const item of order.items) {
      const products = await base44.asServiceRole.entities.Product.filter({ id: item.product_id });
      const product = products[0];
      if (!product) continue;

      const stockUnit = product.stock_unit || 'unite';
      let globalDeduction = item.quantity;
      let updatedVariants = product.variants ? [...product.variants] : null;
      let variantMatched = false;

      if (item.selected_variants && product.variants && product.variants.length > 0) {
        for (const [, variantData] of Object.entries(item.selected_variants)) {
          const variantIndex = product.variants.findIndex(v =>
            v.type === variantData.type && v.value === variantData.value
          );

          if (variantIndex === -1) continue;
          const productVariant = product.variants[variantIndex];

          const parsed = parseVariantValue(productVariant.value);
          if (parsed && ['poids', 'pack', 'lot'].includes(productVariant.type)) {
            const converted = convertToStockUnit(parsed.amount, parsed.unit, stockUnit);
            globalDeduction = item.quantity * converted;
          } else {
            globalDeduction = item.quantity;
          }

          if (typeof productVariant.stock_quantity === 'number') {
            const newVariantStock = Math.max(0, productVariant.stock_quantity - item.quantity);
            updatedVariants[variantIndex] = {
              ...productVariant,
              stock_quantity: newVariantStock
            };
          }

          variantMatched = true;
          break;
        }
      }

      const newGlobalStock = Math.max(0, product.stock_quantity - globalDeduction);
      const updatePayload = { stock_quantity: newGlobalStock };

      if (variantMatched && updatedVariants) {
        updatePayload.variants = updatedVariants;
      }

      await base44.asServiceRole.entities.Product.update(product.id, updatePayload);
    }

    return Response.json({ success: true, message: 'Stock mis à jour' });
  } catch (error) {
    console.error('Erreur:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});