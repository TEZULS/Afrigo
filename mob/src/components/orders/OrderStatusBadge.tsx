import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { palette } from '@/theme/tokens';

/**
 * Mapping COMPLET des statuts du schéma Order Base44 :
 * pending, confirmed, preparing, ready, shipped, delivered, cancelled,
 * failed_delivery, not_delivered.
 *
 * Avant : `shipped` et `failed_delivery` n'étaient pas mappés → le badge
 * retombait sur le défaut "En attente" à chaque transition côté admin.
 */
const STATUS: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'brand' | 'muted' | 'default' }
> = {
  pending: { label: 'En attente', variant: 'warning' },
  confirmed: { label: 'Confirmée', variant: 'brand' },
  preparing: { label: 'En préparation', variant: 'brand' },
  ready: { label: 'Prête', variant: 'brand' },
  shipped: { label: 'Expédiée', variant: 'brand' },
  out_for_delivery: { label: 'En livraison', variant: 'brand' },
  delivered: { label: 'Livrée', variant: 'success' },
  cancelled: { label: 'Annulée', variant: 'destructive' },
  not_delivered: { label: 'Non livrée', variant: 'destructive' },
  failed_delivery: { label: 'Livraison échouée', variant: 'destructive' },
  returned: { label: 'Retournée', variant: 'muted' },
};

export const OrderStatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const key = status ?? 'pending';
  const s = STATUS[key] ?? { label: key, variant: 'default' as const };
  return (
    <Badge
      label={s.label}
      variant={s.variant}
      style={s.variant === 'warning' ? { backgroundColor: palette.yellow[400] } : undefined}
    />
  );
};
