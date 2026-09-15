import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Package, ArrowLeft, MapPin, Calendar, Phone, Mail, 
  RotateCcw, MessageCircle, Navigation, Printer, Star, Clock, CreditCard, ShieldCheck
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { shouldShowDeliveryCode } from '@/lib/deliveryCode';
import OrderStatusBadge from '@/components/orders/OrderStatusBadge';
import OrderTracker from '@/components/orders/OrderTracker';
import ReviewForm from '@/components/reviews/ReviewForm';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from 'sonner';

// Fix leaflet marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function OrderDetails() {
  const [user, setUser] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('id');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => base44.entities.Order.filter({ id: orderId }),
    enabled: !!orderId
  });

  const order = orders[0];

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: customerOrders = [] } = useQuery({
    queryKey: ['customerOrders', order?.customer_email],
    queryFn: () => base44.entities.Order.filter({ customer_email: order?.customer_email }),
    enabled: !!order?.customer_email,
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', orderId],
    queryFn: () => base44.entities.Review.filter({ order_id: orderId }),
    enabled: !!orderId
  });

  const customer = users.find(u => u.email === order?.customer_email);
  const totalOrderCount = customerOrders.length;

  // Ouvrir automatiquement le dialog d'avis pour les commandes livrées sans avis
  useEffect(() => {
    if (order?.status === 'delivered' && order.items?.length > 0 && reviews.length === 0 && user) {
      const timer = setTimeout(() => {
        setSelectedProduct(order.items[0]);
        setReviewDialogOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [order, reviews, user]);

  const createReviewMutation = useMutation({
    mutationFn: async ({ rating, comment }) => {
      return base44.entities.Review.create({
        product_id: selectedProduct.product_id,
        customer_email: user.email,
        customer_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.full_name || 'Client',
        rating,
        comment,
        order_id: orderId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setReviewDialogOpen(false);
      setSelectedProduct(null);
      toast.success('Merci pour votre avis !');
    }
  });

  const handlePrint = () => {
    window.print();
  };

  // Geocode address to get coordinates
  const [coordinates, setCoordinates] = useState(null);
  
  useEffect(() => {
    if (order?.delivery_address && order?.delivery_city) {
      // Default Paris coordinates, in real app would geocode
      setCoordinates([48.8566, 2.3522]);
    }
  }, [order]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Commande non trouvée</p>
          <Link to={createPageUrl('Orders')}>
            <Button className="bg-emerald-500 hover:bg-emerald-600">
              Voir mes commandes
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl('Orders')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6 no-print">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux commandes
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 print:text-center print:mb-2">
              Commande #{order.id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-slate-500 mt-1 print:text-center print:text-sm">
              Passée le {format(new Date(order.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
          <div className="flex items-center gap-3 no-print">
              {user?.role === 'admin' && (
                <Button
                  onClick={handlePrint}
                  variant="outline"
                  className="rounded-xl"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimer
                </Button>
              )}
              {user?.role !== 'admin' && order.status === 'delivered' ? (
                (() => {
                  const deliveryDate = new Date(order.delivered_date || order.updated_date);
                  const now = new Date();
                  const hoursSinceDelivery = (now - deliveryDate) / (1000 * 60 * 60);
                  
                  // Retour possible dans les 2 heures après la livraison
                  if (hoursSinceDelivery <= 2) {
                    return (
                      <Link to={createPageUrl('Returns') + '?order=' + order.id}>
                        <Button
                          className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Retourner des produits
                        </Button>
                      </Link>
                    );
                  } else {
                    return <OrderStatusBadge status={order.status} />;
                  }
                })()
              ) : (
                <OrderStatusBadge status={order.status} />
              )}
            </div>
        </div>

        {/* Version imprimable */}
        <div className="print-only" style={{ padding: '0', background: 'white', color: 'black' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid #ddd' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#FF8C00', margin: '0 0 10px 0' }}>AfriGo</h1>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#333', margin: '0 0 5px 0' }}>
              Bordereau de commande #{order.id.slice(-8).toUpperCase()}
            </h2>
            <p style={{ color: '#666', margin: '5px 0 0 0', fontSize: '13px' }}>
              Date: {format(new Date(order.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
            </p>
          </div>
          
          {/* Suivi de commande */}
          <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #ddd' }}>
            <h3 style={{ fontWeight: 'bold', color: '#333', marginBottom: '12px', fontSize: '14px' }}>Suivi de commande</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
              {['pending','confirmed','preparing','ready','shipped','delivered'].map((s, i, arr) => {
                const labels = { pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation', ready: 'Prête', shipped: 'En livraison', delivered: 'Livrée' };
                const statusOrder = ['pending','confirmed','preparing','ready','shipped','delivered'];
                const currentIdx = statusOrder.indexOf(order.status);
                const stepIdx = statusOrder.indexOf(s);
                const isDone = stepIdx <= currentIdx;
                return (
                  <React.Fragment key={s}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px' }}>
                      <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: isDone ? '#16a34a' : '#e2e8f0', border: `2px solid ${isDone ? '#16a34a' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isDone && <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>✓</span>}
                      </div>
                      <span style={{ fontSize: '9px', color: isDone ? '#16a34a' : '#94a3b8', textAlign: 'center', marginTop: '4px', fontWeight: isDone ? 'bold' : 'normal', maxWidth: '55px', lineHeight: '1.2' }}>{labels[s]}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ flex: 1, height: '2px', background: stepIdx < currentIdx ? '#16a34a' : '#e2e8f0', marginBottom: '18px' }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr', gap: '40px', marginBottom: '30px', paddingBottom: '30px', borderBottom: '1px solid #ddd', alignItems: 'start' }}>
            <div>
              <h3 style={{ fontWeight: 'bold', color: '#333', marginBottom: '15px', fontSize: '14px' }}>Client</h3>
              <p style={{ color: '#333', fontSize: '14px', margin: '8px 0', fontWeight: '500' }}>
                {user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.full_name || order.customer_email}
              </p>
              {customer?.customer_id && (
                <p style={{ fontSize: '13px', color: '#666', margin: '5px 0' }}>{customer.customer_id}</p>
              )}
            </div>
            <div></div>
            <div>
              <h3 style={{ fontWeight: 'bold', color: '#333', marginBottom: '15px', fontSize: '14px' }}>📍 Livraison</h3>
              <p style={{ color: '#333', fontSize: '14px', margin: '8px 0', fontWeight: '500' }}>{order.delivery_address}</p>
              <p style={{ color: '#333', fontSize: '14px', margin: '5px 0' }}>{order.delivery_postal_code} {order.delivery_city}</p>
              {order.estimated_delivery && (
                <p style={{ margin: '8px 0', background: '#dcfce7', color: '#16a34a', padding: '4px 10px', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px', display: 'inline-block' }}>
                  📅 Livraison prévue : {order.estimated_delivery}{order.delivery_time ? ` à ${order.delivery_time}` : ''}
                </p>
              )}
              {customer?.phone && (
                <p style={{ fontWeight: 'bold', color: '#FF8C00', fontSize: '15px', margin: '12px 0 0 0' }}>
                  ☎ {customer.phone}
                </p>
              )}
            </div>
          </div>

          <div style={{ marginBottom: '30px', paddingBottom: '30px', borderBottom: '1px solid #ddd' }}>
            <h3 style={{ fontWeight: 'bold', color: '#333', marginBottom: '15px', fontSize: '14px' }}>Articles commandés</h3>
            {(order.items || []).map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #eee' }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '14px', color: '#333' }}>{item.product_name}</strong><br/>
                  {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                    <div style={{ margin: '5px 0' }}>
                      {Object.entries(item.selected_variants).map(([key, variant]) => 
                        <span key={key} style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', marginRight: '4px' }}>{variant.type}: {variant.value}</span>
                      )}
                    </div>
                  )}
                  <small style={{ color: '#666' }}>{item.quantity} x {item.unit_price?.toFixed(2)}€</small>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>{item.total_price?.toFixed(2)}€</div>
              </div>
            ))}

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
              {/* Totaux livraison */}
              {(() => {
                const itemsSubtotal = (order.items || []).reduce((s, i) => s + (i.total_price || 0), 0);
                const deliveryFee = (order.total_amount || 0) - itemsSubtotal - (order.promo_discount || 0) + (order.wallet_amount_used || 0);
                const hasDeliveryFee = deliveryFee > 0.01;
                return (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span>Sous-total articles</span><span>{itemsSubtotal.toFixed(2)}€</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                      <span>Frais de livraison</span>
                      <span style={{ color: hasDeliveryFee ? '#000' : '#16a34a', fontWeight: hasDeliveryFee ? 'normal' : 'bold' }}>
                        {hasDeliveryFee ? `${deliveryFee.toFixed(2)}€` : 'Offerts 🎁'}
                      </span>
                    </div>
                    {order.promo_discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span>Réduction promo</span><span style={{ color: '#16a34a' }}>-{order.promo_discount.toFixed(2)}€</span>
                      </div>
                    )}
                    {order.wallet_amount_used > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span>Portefeuille</span><span style={{ color: '#16a34a' }}>-{order.wallet_amount_used.toFixed(2)}€</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', borderTop: '2px solid #000', paddingTop: '8px', marginTop: '8px' }}>
                      <span>Total</span><span>{order.total_amount?.toFixed(2)}€</span>
                    </div>
                  </div>
                );
              })()}
              <h3 style={{ fontWeight: 'bold', color: '#333', marginBottom: '10px', fontSize: '14px' }}>Mode de paiement</h3>
              <span style={{ background: order.payment_method === 'delivery' ? '#dcfce7' : '#ffedd5', color: order.payment_method === 'delivery' ? '#16a34a' : '#ea580c', padding: '4px 12px', fontWeight: 'bold', fontSize: '13px', display: 'inline-block' }}>
                {order.payment_method === 'delivery' ? 'PAIEMENT À LA LIVRAISON' : 'PAIEMENT PAR CARTE'}
              </span>
              {order.payment_method === 'delivery' && (
                <p style={{ marginTop: '8px', fontWeight: 'bold', color: '#16a34a', fontSize: '15px' }}>
                  Montant à régler : {(order.amount_to_pay || order.total_amount)?.toFixed(2)}€
                </p>
              )}
            </div>
            
            {/* QR Code - Print Only */}
            <div style={{ marginTop: '30px', paddingTop: '30px', borderTop: '1px solid #ddd', textAlign: 'center' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent('https://www.afrigo.app')}`} alt="QR Code" style={{ width: '120px', height: '120px', display: 'block', margin: '0 auto' }} />
              <p style={{ marginTop: '10px', fontSize: '12px', color: '#666', textAlign: 'center' }}>📱 Scannez pour commander</p>
            </div>
          </div>
        </div>

        {/* Code de confirmation à remettre au livreur */}
        {shouldShowDeliveryCode(order.status, order.delivery_code) && (
          <Card className="border-0 shadow-lg rounded-2xl bg-emerald-50 border border-emerald-200 no-print">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                Code de confirmation
              </p>
              <div className="flex gap-2 mb-3">
                {String(order.delivery_code).split('').map((digit, i) => (
                  <div
                    key={i}
                    className="w-12 h-14 rounded-lg bg-white border border-emerald-200 flex items-center justify-center text-2xl font-extrabold text-slate-900"
                  >
                    {digit}
                  </div>
                ))}
              </div>
              <p className="text-sm text-emerald-800">
                Communiquez ce code au livreur au moment de la remise. Il en a besoin pour valider la
                livraison. Ne le donnez à personne d'autre.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Motif de non-livraison */}
        {(order.status === 'not_delivered' || order.status === 'failed_delivery') && order.delivery_failure_reason && (
          <Card className="border-0 shadow-lg rounded-2xl bg-rose-50 border-rose-200 no-print">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-rose-900 mb-2">
                {order.status === 'not_delivered' ? '❌ Motif de non-livraison' : 'Motif de l\'échec'}
              </p>
              <p className="text-rose-800">{order.delivery_failure_reason}</p>
              {order.status === 'not_delivered' && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    📞 Contactez-nous pour organiser une nouvelle livraison ou obtenir un remboursement.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer - Version imprimable en bas */}
        <div className="print-only" style={{ marginTop: '30px', textAlign: 'center', borderTop: '2px solid #FF8C00', paddingTop: '20px' }}>
          <div style={{ padding: '15px', background: '#fff', borderRadius: '6px', color: 'black' }}>
            <p style={{ fontSize: '12px', color: '#666', margin: '0' }}>www.afrigo.app</p>
          </div>
        </div>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Donnez votre avis sur votre commande</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <ReviewForm
              productId={selectedProduct.product_id}
              productName={selectedProduct.product_name}
              onSubmit={(data) => createReviewMutation.mutate(data)}
              onCancel={() => setReviewDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}