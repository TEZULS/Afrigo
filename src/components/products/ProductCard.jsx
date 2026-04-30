import React from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, ShoppingBag, Percent, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const categoryLabels = {
  fruits_legumes: "Fruits & Légumes",
  viandes_poissons: "Viandes & Poissons",
  produits_laitiers: "Produits Laitiers",
  epices: "Épices",
  boissons: "Boissons",
  surgeles: "Surgelés",
  hygiene: "Hygiène",
  entretien: "Entretien",
  cosmetique: "Cosmétique",
  sec: "Sec",
  frais: "Frais"
};

const unitLabels = {
  piece: "pièce",
  kg: "kg",
  litre: "L",
  pack: "pack"
};

export default function ProductCard({ product, cartQuantity = 0, onAddToCart, onRemoveFromCart, deliveryTime = '2 jours' }) {
  const isOutOfStock = product.stock_quantity <= 0;
  const isPromotion = product.is_promotion && product.promotion_price;
  const displayPrice = isPromotion ? product.promotion_price : product.price;
  const discount = isPromotion ? Math.round((1 - product.promotion_price / product.price) * 100) : 0;
  
  // Utiliser l'image du premier variant si le produit n'a pas d'image principale
  const displayImage = product.image_url || product.variants?.find(v => v.image_url)?.image_url || 'https://images.unsplash.com/photo-1543168256-418811576931?w=400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Link 
        to={createPageUrl('ProductDetails') + `?id=${product.id}`}
        onClick={() => {
          // Sauvegarder la position de scroll de la home avant de naviguer
          sessionStorage.setItem('home_scrollPos', window.scrollY.toString());
        }}
      >
        <Card className="group relative overflow-hidden bg-white border-0 shadow-sm hover:shadow-xl transition-all duration-500 rounded-2xl cursor-pointer">
        {isPromotion && (
          <div className="absolute top-3 left-3 z-10">
            <Badge className="bg-gradient-to-r from-rose-500 to-pink-500 text-white border-0 px-3 py-1 font-semibold shadow-lg">
              <Percent className="w-3 h-3 mr-1" />
              -{discount}%
            </Badge>
          </div>
        )}
        
        <div className="aspect-square overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 p-4 relative">
          <img
            src={displayImage}
            alt={product.name}
            className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-500"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-end justify-center pb-3">
              <span className="bg-slate-800/80 text-white text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">
                Épuisé
              </span>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="mb-2">
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#008000' }}>
              {categoryLabels[product.category]}
            </span>
          </div>
          
          <h3 className="font-semibold text-slate-800 text-lg mb-1 line-clamp-1">
            {product.name}
          </h3>

          {product.show_purchase_count && product.purchase_count > 0 && (
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium mb-1">
              <Users className="w-3 h-3" />
              <span>{product.purchase_count} {product.purchase_count_message || 'personnes ont acheté ce produit'}</span>
            </div>
          )}

          <div className="mb-3">
            <div className="flex items-baseline gap-0.5">
              <span className="text-3xl font-bold text-slate-900">
                {Math.floor(displayPrice)}
              </span>
              <span className="text-lg font-bold text-slate-900">
                .{String((displayPrice % 1).toFixed(2)).split('.')[1]}
              </span>
              <span className="text-xl font-bold text-slate-900">
                €
              </span>
              <span className="text-sm text-slate-500 ml-1">
                / {unitLabels[product.unit] || 'unité'}
              </span>
            </div>
            {isPromotion && (
              <div className="mt-1">
                <span className="text-sm text-slate-400 line-through">
                  {product.price.toFixed(2)}€
                </span>
              </div>
            )}
          </div>

          {isOutOfStock ? (
            <Button
              disabled
              className="w-full rounded-xl h-12 font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
            >
              Épuisé
            </Button>
          ) : cartQuantity === 0 ? (
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddToCart(product);
              }}
              style={{ backgroundColor: '#008000', boxShadow: '0 10px 15px -3px rgba(0, 128, 0, 0.2)' }}
              className="w-full hover:opacity-90 text-white rounded-xl h-12 transition-all duration-300 font-semibold"
            >
              <ShoppingBag className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          ) : (
            <div className="flex items-center justify-between gap-2 bg-slate-100 rounded-xl p-1.5 w-full" onClick={(e) => e.preventDefault()}>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemoveFromCart(product);
                }}
                className="h-10 w-10 rounded-lg hover:bg-white flex-shrink-0"
              >
                <Minus className="w-4 h-4" />
              </Button>
              <span className="flex-1 text-center font-semibold text-slate-800 text-lg">
                {cartQuantity}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAddToCart(product);
                }}
                disabled={cartQuantity >= product.stock_quantity}
                className="h-10 w-10 rounded-lg hover:bg-white flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </Card>
      </Link>
    </motion.div>
  );
}