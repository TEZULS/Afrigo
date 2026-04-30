import React from 'react';
import { Button } from "@/components/ui/button";
import { Apple, Fish, Milk, ShoppingBasket, Wine, Snowflake, Sparkles, SprayCan } from 'lucide-react';
import { motion } from 'framer-motion';

const FOOD_CATS = ['fruits_legumes', 'viandes_poissons', 'produits_laitiers', 'epices', 'boissons', 'surgeles', 'entretien', 'sec', 'frais'];
const COSMETIQUE_CATS = ['cosmetique'];

const categories = [
  { id: 'all', label: 'Tous', icon: ShoppingBasket },
  { id: 'fruits_legumes', label: 'Fruits & Légumes', icon: Apple },
  { id: 'viandes_poissons', label: 'Viandes & Poissons', icon: Fish },
  { id: 'produits_laitiers', label: 'Produits Laitiers', icon: Milk },
  { id: 'epices', label: 'Épices', icon: ShoppingBasket },
  { id: 'boissons', label: 'Boissons', icon: Wine },
  { id: 'surgeles', label: 'Surgelés', icon: Snowflake },
  { id: 'entretien', label: 'Entretien', icon: SprayCan },
  { id: 'cosmetique', label: 'Cosmétique', icon: Sparkles },
  { id: 'sec', label: 'Sec', icon: ShoppingBasket },
  { id: 'frais', label: 'Frais', icon: Snowflake },
];

export default function CategoryFilter({ selected, onSelect, availableCategories = [], shopMode = 'food' }) {
  const modeCats = shopMode === 'cosmetique' ? COSMETIQUE_CATS : FOOD_CATS;
  const visibleCategories = categories.filter(cat => 
    cat.id === 'all' || (modeCats.includes(cat.id) && availableCategories.includes(cat.id))
  );

  return (
    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
      {visibleCategories.map((cat, index) => {
        const Icon = cat.icon;
        const isSelected = selected === cat.id;
        
        return (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Button
              variant={isSelected ? "default" : "outline"}
              onClick={() => onSelect(cat.id)}
              className={`
                whitespace-nowrap rounded-lg px-2 h-8 font-medium transition-all duration-300 text-xs
                ${isSelected 
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-lg shadow-emerald-500/25' 
                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300'
                }
              `}
            >
              <Icon className={`w-3 h-3 mr-0.5 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />
              <span className="text-xs">{cat.label}</span>
            </Button>
          </motion.div>
        );
      })}
    </div>
  );
}