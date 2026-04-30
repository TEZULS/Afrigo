import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, ChevronRight, Calendar, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const statusLabels = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
  completed: 'Terminée'
};

const statusColors = {
  pending: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  completed: 'bg-slate-100 text-slate-700'
};

const returnReasons = {
  wrong_product: 'Erreur de produit',
  damaged: 'Produit endommagé',
  expired: 'Date de produit passée',
  other: 'Autre motif'
};

export default function MyReturns() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['returns', user?.email],
    queryFn: () => base44.entities.Return.filter({ customer_email: user?.email }, '-created_date'),
    enabled: !!user?.email
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <RotateCcw className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Mes demandes de retour</h1>
            <p className="text-slate-500">{returns.length} demande{returns.length > 1 ? 's' : ''}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-32 animate-pulse" />
            ))}
          </div>
        ) : returns.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Aucune demande de retour</p>
          </div>
        ) : (
          <div className="space-y-4">
            {returns.map((returnItem, index) => (
              <motion.div
                key={returnItem.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link to={createPageUrl('ReturnDetails') + `?id=${returnItem.id}`}>
                  <Card className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-sm text-slate-500 mb-1">
                            Retour #{returnItem.id.slice(-8).toUpperCase()}
                          </p>
                          <p className="font-bold text-xl text-slate-800">
                            Commande #{returnItem.order_id.slice(-8).toUpperCase()}
                          </p>
                        </div>
                        <Badge className={statusColors[returnItem.status]}>
                          {statusLabels[returnItem.status]}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4" />
                          {format(new Date(returnItem.created_date), 'dd MMM yyyy', { locale: fr })}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Package className="w-4 h-4" />
                          {returnItem.items?.length || 0} article{returnItem.items?.length > 1 ? 's' : ''}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {returnReasons[returnItem.reason]}
                        </div>
                      </div>

                      {returnItem.refund_amount && (
                        <div className="bg-emerald-50 rounded-lg p-3 mb-4">
                          <p className="text-sm text-emerald-700">
                            Montant du remboursement: <strong>{returnItem.refund_amount.toFixed(2)}€</strong>
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-sm text-slate-600">Voir les détails</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}