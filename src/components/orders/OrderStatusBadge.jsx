import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, Package, Truck, Home, XCircle, AlertCircle } from 'lucide-react';

const statusConfig = {
  pending: {
    label: 'En attente',
    icon: Clock,
    className: 'bg-amber-100 text-amber-700 border-amber-200'
  },
  confirmed: {
    label: 'Confirmée',
    icon: CheckCircle,
    className: 'bg-blue-100 text-blue-700 border-blue-200'
  },
  preparing: {
    label: 'En préparation',
    icon: Package,
    className: 'bg-purple-100 text-purple-700 border-purple-200'
  },
  ready: {
    label: 'Prête',
    icon: CheckCircle,
    className: 'bg-teal-100 text-teal-700 border-teal-200'
  },
  shipped: {
    label: 'En livraison',
    icon: Truck,
    className: 'bg-indigo-100 text-indigo-700 border-indigo-200'
  },
  delivered: {
    label: 'Livrée',
    icon: Home,
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200'
  },
  cancelled: {
    label: 'Annulée',
    icon: XCircle,
    className: 'bg-rose-100 text-rose-700 border-rose-200'
  },
  payment_failed: {
    label: 'Échec de paiement',
    icon: AlertCircle,
    className: 'bg-orange-100 text-orange-700 border-orange-200'
  }
};

export default function OrderStatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.className} px-3 py-1.5 font-medium border`}>
      <Icon className="w-3.5 h-3.5 mr-1.5" />
      {config.label}
    </Badge>
  );
}