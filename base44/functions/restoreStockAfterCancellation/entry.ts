import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Fonction pour convertir les unités en unité de base
function convertToBaseUnit(quantity, fromUnit, toUnit) {
  // Conversions de poids
  const weightUnits = {
    'g': 1,
    'gramme': 1,
    'grammes': 1,
    'kg': 1000,
    'kilo': 1000,
    'kilogramme': 1000,
    'kilogrammes': 1000
  };
  
  // Conversions de volume
  const volumeUnits = {
    'ml': 1,
    'millilitre': 1,
    'millilitres': 1,
    'litre': 1000,
    'litres': 1000,
    'l': 1000
  };
  
  // Déterminer le type d'unité
  const fromUnitLower = fromUnit.toLowerCase();
  const toUnitLower = toUnit.toLowerCase();
  
  let conversionTable = null;
  
  // Vérifier si c'est du poids
  if (weightUnits[fromUnitLower] && weightUnits[toUnitLower]) {
    conversionTable = weightUnits;
  }
  // Vérifier si c'est du volume
  else if (volumeUnits[fromUnitLower] && volumeUnits[toUnitLower]) {
    conversionTable = volumeUnits;
  }
  
  if (!conversionTable) {
    // Pas de conversion possible, retourner la quantité telle quelle
    return quantity;
  }
  
  // Convertir en unité de base puis en unité cible
  const baseQuantity = quantity * conversionTable[fromUnitLower];
  const targetQuantity = baseQuantity / conversionTable[toUnitLower];
  
  return targetQuantity;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { orderId } = await req.json();
    
    if (!orderId) {
      return Response.json({ error: 'Order ID requis' }, { status: 400 });
    }
    
    // Récupérer la commande
    const orders = await base44.asServiceRole.entities.Order.filter({ id: orderId });
    const order = orders[0];
    
    if (!order) {
      return Response.json({ error: 'Commande non trouvée' }, { status: 404 });
    }
    
    // Pour chaque article de la commande
    for (const item of order.items) {
      const products = await base44.asServiceRole.entities.Product.filter({ id: item.product_id });
      const product = products[0];
      
      if (!product) continue;
      
      let quantityToRestore = item.quantity;
      let variantStockUnit = product.stock_unit;
      
      // Si le produit a des variantes et que le client en a sélectionné
      if (item.selected_variants && product.variants) {
        // Chercher la variante exacte achetée par le client
        for (const [key, variantData] of Object.entries(item.selected_variants)) {
          const productVariant = product.variants.find(v => 
            v.type === variantData.type && v.value === variantData.value
          );
          
          if (productVariant && ['poids', 'pack', 'lot'].includes(productVariant.type)) {
            // Extraire la valeur numérique et l'unité de la variante achetée
            const match = productVariant.value.match(/^([\d.]+)\s*(\w+)$/);
            
            if (match) {
              const variantQuantity = parseFloat(match[1]);
              const variantUnit = match[2];
              
              // Convertir la quantité de la variante achetée en unité de stock
              const convertedQuantity = convertToBaseUnit(variantQuantity, variantUnit, variantStockUnit);
              quantityToRestore = item.quantity * convertedQuantity;
              break;
            }
          }
        }
      }
      
      // Restaurer le stock du produit
      const newStock = product.stock_quantity + quantityToRestore;
      await base44.asServiceRole.entities.Product.update(product.id, {
        stock_quantity: newStock
      });
    }
    
    return Response.json({ success: true, message: 'Stock restauré' });
  } catch (error) {
    console.error('Erreur:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});