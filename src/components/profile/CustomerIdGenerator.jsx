import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function CustomerIdGenerator({ user, onIdGenerated }) {
  useEffect(() => {
    if (!user || (user.customer_id && user.referral_code)) return;

    const generateCustomerData = async () => {
      const updates = {};
      
      if (!user.customer_id) {
        const randomId = Math.floor(100000 + Math.random() * 900000);
        updates.customer_id = `CL${randomId}`;
      }
      
      if (!user.referral_code) {
        updates.referral_code = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
      }
      
      if (Object.keys(updates).length === 0) return;

      try {
        await base44.auth.updateMe(updates);
        
        if (updates.referral_code) {
          try {
            await base44.entities.PromoCode.create({
              code: updates.referral_code,
              owner_email: user.email,
              discount_type: 'percentage',
              discount_value: 10
            });
          } catch {
            // Code promo déjà existant, ignorer
          }
        }
        
        if (onIdGenerated) onIdGenerated(updates);
      } catch (error) {
        // Silently fail - will retry on next load
      }
    };

    // Délai pour éviter le rate limit au premier chargement
    const timeout = setTimeout(generateCustomerData, 2000);
    return () => clearTimeout(timeout);
  }, [user?.email]);

  return null;
}