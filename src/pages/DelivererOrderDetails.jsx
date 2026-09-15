import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Package, MapPin, Phone, Clock, CheckCircle, XCircle, 
  ArrowLeft, Banknote, User, Mail, AlertCircle, Truck 
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { isDeliveryCodeComplete, verifyDeliveryCode, normalizeDeliveryCode } from '@/lib/deliveryCode';

export default function DelivererOrderDetails() {
  const [user, setUser] = useState(null);
  const [dialogType, setDialogType] = useState(null); // 'delivered' ou 'failed'
  const [failureReason, setFailureReason] = useState('');
  const [confirmedAmount, setConfirmedAmount] = useState('');
  const [deliveryCodeInput, setDeliveryCodeInput] = useState('');
  const [showGpsDialog, setShowGpsDialog] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');
  const token = urlParams.get('token');

  useEffect(() => {
    // Vérifier le token depuis l'URL
    if (!token) {
      navigate(createPageUrl('DelivererLogin'));
      return;
    }

    // Vérifier le token via l'API
    base44.entities.Deliverer.list().then(deliverers => {
      const deliverer = deliverers.find(d => d.access_token === token && d.is_active);
      
      if (!deliverer) {
        navigate(createPageUrl('DelivererLogin'));
        return;
      }

      setUser({ email: deliverer.email, full_name: deliverer.full_name });
    }).catch(() => {
      navigate(createPageUrl('DelivererLogin'));
    });
  }, [navigate, token]);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => base44.entities.Order.filter({ id: orderId }),
    enabled: !!orderId,
    select: (data) => data[0]
  });

  const { data: customer } = useQuery({
    queryKey: ['customer', order?.customer_email],
    queryFn: () => base44.entities.User.filter({ email: order.customer_email }),
    enabled: !!order?.customer_email,
    select: (data) => data[0]
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ status, reason, cashCollected }) => {
      const updateData = {
        status
      };
      
      // Ajouter la date de livraison seulement pour delivered/failed
      if (status === 'delivered' || status === 'failed_delivery') {
        updateData.delivered_date = new Date().toISOString();
      }
      
      if (status === 'failed_delivery' && reason) {
        updateData.delivery_failure_reason = reason;
      }
      
      if (status === 'delivered' && order.payment_method === 'delivery' && cashCollected) {
        updateData.cash_collected = cashCollected;
        
        // Créer un enregistrement de collecte d'espèces
        await base44.entities.CashCollection.create({
          deliverer_email: user.email,
          order_id: orderId,
          amount: cashCollected,
          collection_date: new Date().toISOString(),
          is_archived: false
        });
      }
      
      return base44.entities.Order.update(orderId, updateData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['delivererOrders'] });
      queryClient.invalidateQueries({ queryKey: ['cashCollections'] });
      
      if (variables.status === 'shipped') {
        toast.success('Commande prise en charge');
      } else {
        toast.success('Statut de livraison mis à jour');
        setDialogType(null);
        setFailureReason('');
        setDeliveryCodeInput('');
        navigate(createPageUrl('DelivererDashboard') + `?token=${token}`);
      }
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    }
  });

  const handleTakeCharge = () => {
    updateOrderMutation.mutate({ status: 'shipped' });
  };

  const handleDelivered = () => {
    /**
     * Code de confirmation à 4 chiffres : le client le lit dans sa commande et
     * le donne au livreur à la remise. Les commandes créées avant cette
     * fonctionnalité n'ont pas de code — on ne bloque pas le livreur.
     */
    if (order.delivery_code && !verifyDeliveryCode(deliveryCodeInput, order.delivery_code)) {
      toast.error('❌ Code de confirmation incorrect. Demandez au client les 4 chiffres affichés dans sa commande.');
      return;
    }

    // Vérifier si c'est un paiement en espèces
    if (order.payment_method === 'delivery') {
      const enteredAmount = parseFloat(confirmedAmount);
      const expectedAmount = order.amount_to_pay || order.total_amount;
      
      // Vérifier que le montant est valide et correspond
      if (!confirmedAmount || isNaN(enteredAmount)) {
        toast.error('❌ Veuillez saisir le montant collecté');
        return;
      }
      
      // Comparer avec tolérance de 0.01€ pour éviter les problèmes d'arrondi
      if (Math.abs(enteredAmount - expectedAmount) > 0.01) {
        toast.error(`❌ Le montant est incorrect. Vous devez saisir exactement ${expectedAmount.toFixed(2)}€`, {
          duration: 5000
        });
        return;
      }
      
      updateOrderMutation.mutate({ 
        status: 'delivered',
        cashCollected: expectedAmount 
      });
    } else {
      // Paiement par carte, pas besoin de montant
      updateOrderMutation.mutate({ 
        status: 'delivered',
        cashCollected: 0 
      });
    }
  };

  const handleFailed = () => {
    if (!failureReason.trim()) {
      toast.error('Le motif est obligatoire');
      return;
    }
    updateOrderMutation.mutate({ 
      status: 'failed_delivery',
      reason: failureReason 
    });
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Commande introuvable</h2>
            <Button onClick={() => navigate(createPageUrl('DelivererDashboard') + `?token=${token}`)}>
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (order.assigned_deliverer !== user.email) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Accès refusé</h2>
            <p className="text-slate-600 mb-4">Cette commande ne vous est pas assignée</p>
            <Button onClick={() => navigate(createPageUrl('DelivererDashboard') + `?token=${token}`)}>
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCompleted = order.status === 'delivered' || order.status === 'failed_delivery';
  const isReady = order.status === 'ready';
  const isInDelivery = order.status === 'shipped';

  const handleOpenGps = (app) => {
    const address = encodeURIComponent(`${order.delivery_address}, ${order.delivery_postal_code} ${order.delivery_city}`);
    
    if (app === 'maps') {
      // Google Maps
      if (order.delivery_lat && order.delivery_lng) {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}`, '_blank');
      } else {
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${address}`, '_blank');
      }
    } else if (app === 'waze') {
      // Waze
      if (order.delivery_lat && order.delivery_lng) {
        window.open(`https://waze.com/ul?ll=${order.delivery_lat},${order.delivery_lng}&navigate=yes`, '_blank');
      } else {
        window.open(`https://waze.com/ul?q=${address}&navigate=yes`, '_blank');
      }
    }
    
    setShowGpsDialog(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl('DelivererDashboard') + `?token=${token}`)}
              className="rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">
                Commande #{order.id.slice(-8).toUpperCase()}
              </h1>
              <p className="text-sm text-slate-500">Détails de la livraison</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        {/* Montant */}
        <Card className="border-0 shadow-lg rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Montant total</p>
                <p className="text-4xl font-bold text-slate-800">
                  {order.total_amount?.toFixed(2)}€
                </p>
                {order.payment_method === 'delivery' && (
                  <Badge className="mt-2 bg-amber-100 text-amber-700">
                    <Banknote className="w-3 h-3 mr-1" />
                    Paiement en espèces à collecter
                  </Badge>
                )}
              </div>
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations client */}
        <Card className="border-0 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Informations client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer && (
              <div className="flex items-center gap-2 pb-3 border-b">
                <User className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="font-semibold text-slate-800">
                    {customer.first_name} {customer.last_name}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700">{order.customer_email}</span>
            </div>

            {customer?.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400" />
                <a 
                  href={`tel:${customer.phone}`}
                  className="text-blue-600 hover:text-blue-700 font-medium underline"
                >
                  {customer.phone}
                </a>
              </div>
            )}
            
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
              <div 
                onClick={() => setShowGpsDialog(true)}
                className="flex-1 cursor-pointer hover:bg-blue-50 p-2 -m-2 rounded-lg transition-colors"
              >
                <p className="font-medium text-blue-600 hover:text-blue-700 underline">
                  {order.delivery_address}
                </p>
                <p className="text-slate-600">
                  {order.delivery_postal_code} {order.delivery_city}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  📍 Cliquez pour ouvrir dans GPS
                </p>
              </div>
            </div>

            {order.delivery_time && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-500">Livraison prévue</p>
                  <p className="font-medium text-slate-700">
                    {order.estimated_delivery ? format(new Date(order.estimated_delivery), 'dd/MM/yyyy', { locale: fr }) : '-'} à {order.delivery_time}
                  </p>
                </div>
              </div>
            )}
            
            {order.notes && (
              <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium text-amber-900 mb-1">Instructions spéciales:</p>
                <p className="text-sm text-amber-800">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Articles */}
        <Card className="border-0 shadow-lg rounded-2xl">
          <CardHeader>
            <CardTitle>Articles de la commande</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-800">{item.product_name}</h4>
                    <p className="text-sm text-slate-500">Quantité: {item.quantity}</p>
                    {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(item.selected_variants).map(([type, variant]) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {variant.value}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-lg font-bold text-slate-800">
                    {item.total_price?.toFixed(2)}€
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        {!isCompleted && (
          <Card className="border-0 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle>Actions de livraison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isReady && (
                <Button
                  onClick={handleTakeCharge}
                  disabled={updateOrderMutation.isPending}
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-lg font-semibold"
                >
                  <Truck className="w-5 h-5 mr-2" />
                  {updateOrderMutation.isPending ? 'Prise en charge...' : 'Prendre en charge la commande'}
                </Button>
              )}
              
              {isInDelivery && (
                <>
                  <Button
                    onClick={() => setDialogType('delivered')}
                    className="w-full h-14 bg-green-600 hover:bg-green-700 text-white rounded-xl text-lg font-semibold"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Marquer comme livrée
                  </Button>
                  <Button
                    onClick={() => setDialogType('failed')}
                    variant="outline"
                    className="w-full h-14 border-2 border-rose-500 text-rose-600 hover:bg-rose-50 rounded-xl text-lg font-semibold"
                  >
                    <XCircle className="w-5 h-5 mr-2" />
                    Échec de livraison
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {isCompleted && (
          <Card className="border-0 shadow-lg rounded-2xl">
            <CardContent className="p-6 text-center">
              {order.status === 'delivered' ? (
                <>
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Commande livrée</h3>
                  <p className="text-slate-600">
                    Livrée le {format(new Date(order.delivered_date), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                  {order.payment_method === 'delivery' && (
                    <p className="text-green-700 font-medium mt-2">
                      Espèces collectées: {order.cash_collected?.toFixed(2)}€
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <XCircle className="w-8 h-8 text-rose-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Échec de livraison</h3>
                  <p className="text-slate-600 mb-2">
                    {format(new Date(order.delivered_date), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-left">
                    <p className="text-sm font-medium text-rose-900">Motif:</p>
                    <p className="text-sm text-rose-800">{order.delivery_failure_reason}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation Delivered */}
      <Dialog open={dialogType === 'delivered'} onOpenChange={() => {
        setDialogType(null);
        setConfirmedAmount('');
        setDeliveryCodeInput('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la livraison</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-slate-700">
              Confirmez-vous avoir livré cette commande au client ?
            </p>
            {order.delivery_code && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <Label htmlFor="delivery-code" className="text-base font-semibold text-emerald-900">
                  Code de confirmation du client *
                </Label>
                <p className="text-sm text-emerald-800 mt-1 mb-2">
                  Demandez au client les 4 chiffres affichés dans sa commande.
                </p>
                <Input
                  id="delivery-code"
                  inputMode="numeric"
                  maxLength={4}
                  value={deliveryCodeInput}
                  onChange={(e) => setDeliveryCodeInput(normalizeDeliveryCode(e.target.value))}
                  placeholder="0000"
                  className={`text-2xl font-bold tracking-[0.5em] text-center ${
                    isDeliveryCodeComplete(deliveryCodeInput) &&
                    !verifyDeliveryCode(deliveryCodeInput, order.delivery_code)
                      ? 'border-rose-500 focus:ring-rose-500'
                      : ''
                  }`}
                />
                {isDeliveryCodeComplete(deliveryCodeInput) &&
                  !verifyDeliveryCode(deliveryCodeInput, order.delivery_code) && (
                    <p className="text-sm text-rose-600 mt-2 font-medium">❌ Code incorrect</p>
                  )}
              </div>
            )}
            {order.payment_method === 'delivery' && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Banknote className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900 mb-1">Paiement en espèces</p>
                      <p className="text-sm text-amber-800">
                        Montant attendu: <strong>{order.amount_to_pay?.toFixed(2)}€</strong>
                      </p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="cash-amount" className="text-base font-semibold">
                    Confirmez le montant exact collecté *
                  </Label>
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      id="cash-amount"
                      type="number"
                      step="0.01"
                      value={confirmedAmount}
                      onChange={(e) => setConfirmedAmount(e.target.value)}
                      placeholder={(order.amount_to_pay || order.total_amount)?.toFixed(2)}
                      className={`text-lg font-semibold ${
                        confirmedAmount && Math.abs(parseFloat(confirmedAmount) - (order.amount_to_pay || order.total_amount)) > 0.01
                          ? 'border-rose-500 focus:ring-rose-500'
                          : ''
                      }`}
                    />
                    <span className="text-lg font-semibold text-slate-600">€</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">
                    Saisissez exactement {(order.amount_to_pay || order.total_amount)?.toFixed(2)}€ pour confirmer
                  </p>
                  {confirmedAmount && Math.abs(parseFloat(confirmedAmount) - (order.amount_to_pay || order.total_amount)) > 0.01 && (
                    <p className="text-sm text-rose-600 mt-2 font-medium">
                      ❌ Montant incorrect - Attendu: {(order.amount_to_pay || order.total_amount)?.toFixed(2)}€
                    </p>
                  )}
                </div>
              </div>
            )}
            <p className="text-sm text-rose-600">
              ⚠️ Cette action est irréversible
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDialogType(null);
              setConfirmedAmount('');
              setDeliveryCodeInput('');
            }}>
              Annuler
            </Button>
            <Button
              onClick={handleDelivered}
              disabled={
                updateOrderMutation.isPending ||
                (order.payment_method === 'delivery' && !confirmedAmount) ||
                (order.delivery_code && !isDeliveryCodeComplete(deliveryCodeInput))
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {updateOrderMutation.isPending ? 'Confirmation...' : 'Confirmer la livraison'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GPS Selection Dialog */}
      <Dialog open={showGpsDialog} onOpenChange={setShowGpsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choisir votre GPS</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-slate-700 mb-4">
              Sélectionnez l'application GPS pour naviguer vers :
            </p>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm font-medium text-slate-800">{order.delivery_address}</p>
              <p className="text-sm text-slate-600">{order.delivery_postal_code} {order.delivery_city}</p>
            </div>
            
            <Button
              onClick={() => handleOpenGps('maps')}
              className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-lg font-semibold justify-start"
            >
              <MapPin className="w-6 h-6 mr-3" />
              Google Maps
            </Button>
            
            <Button
              onClick={() => handleOpenGps('waze')}
              className="w-full h-14 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl text-lg font-semibold justify-start"
            >
              <MapPin className="w-6 h-6 mr-3" />
              Waze
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Failed Delivery */}
      <Dialog open={dialogType === 'failed'} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Échec de livraison</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-slate-700">
              Veuillez indiquer le motif de l'échec de livraison
            </p>
            <div>
              <Label htmlFor="reason">Motif * (obligatoire)</Label>
              <Textarea
                id="reason"
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                placeholder="Ex: Client absent, adresse incorrecte, refus du colis..."
                className="mt-2 min-h-[100px]"
              />
            </div>
            <p className="text-sm text-rose-600">
              ⚠️ Cette action est irréversible
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>
              Annuler
            </Button>
            <Button
              onClick={handleFailed}
              disabled={updateOrderMutation.isPending || !failureReason.trim()}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {updateOrderMutation.isPending ? 'Confirmation...' : 'Confirmer l\'échec'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}