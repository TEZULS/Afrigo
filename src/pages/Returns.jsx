import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, RotateCcw, CheckCircle, Package, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

const returnReasons = {
  wrong_product: 'Mauvais produit',
  expired: 'Date de produit expirée'
};

export default function Returns() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    reason: '',
    description: '',
    items: []
  });
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {
      navigate(createPageUrl('Home'));
    });
  }, [navigate]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => base44.entities.Order.filter({ id: orderId }),
    enabled: !!orderId
  });

  const order = orders[0];

  // Vérifier si le retour est possible (2 heures après la livraison)
  const canReturn = () => {
    if (!order || order.status !== 'delivered') return false;
    
    const deliveryDate = new Date(order.delivered_date || order.updated_date);
    const now = new Date();
    const hoursSinceDelivery = (now - deliveryDate) / (1000 * 60 * 60);
    
    return hoursSinceDelivery <= 2;
  };

  const createReturnMutation = useMutation({
    mutationFn: () => base44.entities.Return.create({
      order_id: orderId,
      customer_email: user.email,
      reason: formData.reason,
      description: formData.description,
      items: formData.items,
      status: 'pending',
      refund_amount: order.total_amount
    }),
    onSuccess: () => {
      setSubmitted(true);
      toast.success('Demande de retour envoyée');
    }
  });

  const toggleItem = (item) => {
    const exists = formData.items.find(i => i.product_name === item.product_name);
    if (exists) {
      setFormData({
        ...formData,
        items: formData.items.filter(i => i.product_name !== item.product_name)
      });
    } else {
      setFormData({
        ...formData,
        items: [...formData.items, { product_name: item.product_name, quantity: item.quantity }]
      });
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-8 md:p-12 max-w-md w-full text-center shadow-xl"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Demande envoyée !</h1>
          <p className="text-slate-500 mb-8">
            Votre demande de retour sera traitée dans les heures à venir.
          </p>
          <Link to={createPageUrl('Orders')}>
            <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl">
              Voir mes commandes
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  if (isLoading || !order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!canReturn()) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-8 md:p-12 max-w-md w-full text-center shadow-xl"
        >
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-rose-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Délai dépassé</h1>
          <p className="text-slate-500 mb-8">
            Le délai de 2 heures pour retourner des produits après la livraison est dépassé.
          </p>
          <Link to={createPageUrl('Orders')}>
            <Button className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl">
              Retour aux commandes
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to={createPageUrl('OrderDetails') + `?id=${orderId}`} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à la commande
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <RotateCcw className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Demande de retour</h1>
              <p className="text-slate-500">Commande #{order.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>

          <Card className="border-0 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-500" />
                Articles à retourner
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                {order.items?.map((item, index) => (
                  <div
                    key={index}
                    className={`
                      flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${formData.items.find(i => i.product_name === item.product_name)
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-100 hover:border-slate-200'
                      }
                    `}
                    onClick={() => toggleItem(item)}
                  >
                    <Checkbox
                      checked={!!formData.items.find(i => i.product_name === item.product_name)}
                      className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{item.product_name}</p>
                      <p className="text-sm text-slate-500">Quantité: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">{item.total_price?.toFixed(2)}€</p>
                  </div>
                ))}
              </div>

              <div>
                <Label>Raison du retour</Label>
                <Select
                  value={formData.reason}
                  onValueChange={(value) => setFormData({...formData, reason: value})}
                >
                  <SelectTrigger className="h-12 rounded-xl mt-1">
                    <SelectValue placeholder="Sélectionnez une raison" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(returnReasons).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Description (optionnel)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Décrivez le problème en détail..."
                  className="rounded-xl mt-1 min-h-[100px]"
                />
              </div>

              <Button
                onClick={() => createReturnMutation.mutate()}
                disabled={!formData.reason || formData.items.length === 0 || createReturnMutation.isPending}
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
              >
                {createReturnMutation.isPending ? 'Envoi en cours...' : 'Envoyer la demande de retour'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}