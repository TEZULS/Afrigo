import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function DelivererIdGenerator({ deliverers, onIdGenerated }) {
  useEffect(() => {
    const generateIds = async () => {
      const deliverersWithoutId = deliverers.filter(d => !d.deliverer_id);
      
      if (deliverersWithoutId.length === 0) return;

      // Trouver le numéro le plus élevé existant
      const existingIds = deliverers
        .filter(d => d.deliverer_id && d.deliverer_id.match(/^[A-Z]{3}\d{4}$/))
        .map(d => {
          const match = d.deliverer_id.match(/[A-Z]{3}(\d{4})/);
          return match ? parseInt(match[1]) : 0;
        });
      
      let nextNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

      for (const deliverer of deliverersWithoutId) {
        const delivererId = `LIV${String(nextNumber).padStart(4, '0')}`;
        
        await base44.entities.Deliverer.update(deliverer.id, {
          deliverer_id: delivererId
        });
        
        nextNumber++;
      }

      if (onIdGenerated) {
        onIdGenerated();
      }
    };

    if (deliverers && deliverers.length > 0) {
      generateIds();
    }
  }, [deliverers, onIdGenerated]);

  return null;
}