import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Percent, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ProductCard from '@/components/products/ProductCard';
import CategoryFilter from '@/components/products/CategoryFilter';

export default function Promotions() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [guestCart, setGuestCart] = useState([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem('guestCart');
      if (saved) {
        setGuestCart(JSON.parse(saved));
      }
    }
  }, [user]);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: cartItems = [] } = useQuery({
    queryKey: ['cart', user?.email],
    queryFn: () => base44.entities.CartItem.filter({ customer_email: user?.email }),
    enabled: !!user?.email
  });

  const displayCart = user ? cartItems : guestCart;

  const addToGuestCart = (product) => {
    const existingItem = guestCart.find(item => item.product_id === product.id);
    let updated;
    if (existingItem) {
      updated = guestCart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      updated = [...guestCart, {
        id: `guest-${Date.now()}`,
        product_id: product.id,
        product_name: product.name,
        product_image: product.image_url,
        quantity: 1,
        unit_price: product.promotion_price || product.price,
        unit: product.unit
      }];
    }
    setGuestCart(updated);
    localStorage.setItem('guestCart', JSON.stringify(updated));
  };

  const addToCartMutation = useMutation({
    mutationFn: async (product) => {
      const existingItem = cartItems.find(item => item.product_id === product.id);
      if (existingItem) {
        return base44.entities.CartItem.update(existingItem.id, {
          quantity: existingItem.quantity + 1
        });
      } else {
        return base44.entities.CartItem.create({
          customer_email: user.email,
          product_id: product.id,
          product_name: product.name,
          product_image: product.image_url,
          quantity: 1,
          unit_price: product.promotion_price || product.price,
          unit: product.unit
        });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] })
  });

  const handleAddToCart = (product) => {
    if (user) {
      addToCartMutation.mutate(product);
    } else {
      addToGuestCart(product);
    }
  };

  useEffect(() => {
    if (!user) {
      const saved = localStorage.getItem('guestCart');
      if (saved) {
        setGuestCart(JSON.parse(saved));
      }
    }
  }, [user]);

  const updateCartMutation = useMutation({
    mutationFn: async ({ id, quantity }) => {
      if (quantity <= 0) {
        return base44.entities.CartItem.delete(id);
      }
      return base44.entities.CartItem.update(id, { quantity });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] })
  });

  const handleRemoveFromCart = (product) => {
    if (user) {
      const existingItem = cartItems.find(item => item.product_id === product.id);
      if (existingItem) {
        updateCartMutation.mutate({ id: existingItem.id, quantity: existingItem.quantity - 1 });
      }
    } else {
      const existingItem = guestCart.find(item => item.product_id === product.id);
      if (existingItem) {
        const updated = guestCart.map(item =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        ).filter(item => item.quantity > 0);
        setGuestCart(updated);
        localStorage.setItem('guestCart', JSON.stringify(updated));
      }
    }
  };

  const promotionProducts = products.filter(p => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      p.name?.toLowerCase().includes(query) ||
      p.description?.toLowerCase().includes(query);
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return p.is_promotion && matchesCategory && matchesSearch;
  });

  const getCartQuantity = (productId) => {
    const item = displayCart.find(i => i.product_id === productId);
    return item?.quantity || 0;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link to={createPageUrl('Home')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à l'accueil
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
            <Percent className="w-6 h-6 text-rose-500" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Toutes les Promotions</h1>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Rechercher dans les promotions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 pl-12 rounded-xl"
            />
          </div>
          <CategoryFilter
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            availableCategories={[...new Set(products.map(p => p.category))]}
          />
        </div>

        {promotionProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500 text-lg">Aucune promotion trouvée</p>
          </div>
        ) : (
          <>
            <p className="text-slate-600 mb-6">{promotionProducts.length} produit{promotionProducts.length > 1 ? 's' : ''} en promotion</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {promotionProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  cartQuantity={getCartQuantity(product.id)}
                  onAddToCart={() => handleAddToCart(product)}
                  onRemoveFromCart={() => handleRemoveFromCart(product)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}