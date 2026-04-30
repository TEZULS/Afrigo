import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Package, Calendar, FileText, Euro } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import ReturnTracker from '@/components/returns/ReturnTracker';

const statusLabels = {
  pending: 'En attente',
  rejected: 'Refusé',
  approved: 'Approuvé',
  completed: 'Terminé'
};

const statusColors = {
  pending: 'bg-amber-100 text-amber-700',
  rejected: 'bg-rose-100 text-rose-700',
  approved: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700'
};

const returnReasons = {
  wrong_product: 'Mauvais produit',
  expired: 'Date de produit expirée'
};

export default function ReturnDetails() {
  const [user, setUser] = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const returnId = urlParams.get('id');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: returns = [], isLoading } = useQuery({
    queryKey: ['return', returnId],
    queryFn: () => base44.entities.Return.filter({ id: returnId }),
    enabled: !!returnId
  });

  const returnItem = returns[0];

  if (isLoading || !returnItem) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl('MyReturns')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux demandes
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Retour #{returnItem.id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-slate-500 mt-1">
              Demandé le {format(new Date(returnItem.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
          <Badge className={statusColors[returnItem.status]}>
            {statusLabels[returnItem.status]}
          </Badge>
        </div>

        {/* Return Tracker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <ReturnTracker currentStatus={returnItem.status} rejectionReason={returnItem.rejection_reason} />
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Return Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-500" />
                  Informations du retour
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Commande associée</p>
                  <Link 
                    to={createPageUrl('OrderDetails') + `?id=${returnItem.order_id}`}
                    className="font-medium text-emerald-600 hover:underline"
                  >
                    #{returnItem.order_id.slice(-8).toUpperCase()}
                  </Link>
                </div>

                <Separator />

                <div>
                  <p className="text-sm text-slate-500 mb-1">Raison du retour</p>
                  <p className="font-medium text-slate-800">{returnReasons[returnItem.reason]}</p>
                </div>

                {returnItem.description && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Description</p>
                      <p className="text-slate-700">{returnItem.description}</p>
                    </div>
                  </>
                )}

                {returnItem.rejection_reason && (
                  <>
                    <Separator />
                    <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
                      <p className="text-sm font-medium text-rose-700 mb-1">Motif du refus</p>
                      <p className="text-slate-700">{returnItem.rejection_reason}</p>
                    </div>
                  </>
                )}

                {returnItem.refund_amount && (
                  <>
                    <Separator />
                    <div className="bg-emerald-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Euro className="w-4 h-4 text-emerald-600" />
                        <p className="text-sm font-medium text-emerald-700">Montant du remboursement</p>
                      </div>
                      <p className="text-2xl font-bold text-emerald-600">
                        {returnItem.refund_amount.toFixed(2)}€
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Items */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-orange-500" />
                  Articles à retourner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {returnItem.items?.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-3 border-b border-slate-100 last:border-0">
                    <div>
                      <p className="font-medium text-slate-800">{item.product_name}</p>
                      <p className="text-sm text-slate-500">Quantité: {item.quantity}</p>
                    </div>
                  </div>
                ))}

                {returnItem.items?.length === 0 && (
                  <p className="text-slate-500 text-center py-4">Aucun article spécifié</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Status Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <Card className="border-0 shadow-sm rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                Historique
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="font-medium text-slate-800">Demande créée</p>
                    <p className="text-sm text-slate-500">
                      {format(new Date(returnItem.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                    </p>
                  </div>
                </div>

                {returnItem.status !== 'pending' && (
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      returnItem.status === 'rejected' ? 'bg-rose-500' : 
                      returnItem.status === 'completed' ? 'bg-emerald-500' : 
                      'bg-blue-500'
                    }`}></div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {statusLabels[returnItem.status]}
                      </p>
                      <p className="text-sm text-slate-500">
                        {format(new Date(returnItem.updated_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}