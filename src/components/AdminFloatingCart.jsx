import React, { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import CartDrawer from '@/components/cart/CartDrawer';

export default function AdminFloatingCart({ cartCount = 0, cartItems = [], cartTotal = 0, onUpdateQuantity, onRemove, user, guestCart, setGuestCart }) {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setCartOpen(true)}
        className="fixed bottom-6 right-6 z-40 p-3 rounded-full bg-orange-600 text-white shadow-lg hover:bg-orange-700 transition-all"
      >
        <ShoppingCart className="w-6 h-6" />
        {cartCount > 0 && (
          <span className="absolute -top-2 -right-2 min-w-[1.5rem] h-6 px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {cartCount}
          </span>
        )}
      </button>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={onRemove}
        total={cartTotal}
        user={user}
        guestCart={guestCart}
        setGuestCart={setGuestCart}
      />
    </>
  );
}