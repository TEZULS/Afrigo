import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Printer } from 'lucide-react';

export function printBordereau(order, users) {
  const customer = users?.find(u => u.email === order?.customer_email);
  const customerName = customer?.first_name && customer?.last_name
    ? `${customer.first_name} ${customer.last_name}`
    : order?.customer_email;

  const amountToPay = (order?.amount_to_pay || order?.total_amount)?.toFixed(2);
  const dateStr = format(new Date(order?.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr });
  const orderId = order?.id.slice(-8).toUpperCase();

  const itemsHtml = (order?.items || []).map(item => `
    <div style="padding-bottom:10px; border-bottom:1px solid #eee; margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between;">
        <b>${item.product_name}</b>
        <b>${item.total_price?.toFixed(2)}€</b>
      </div>
      <div style="font-size:12px; color:#666;">${item.quantity} x ${item.unit_price?.toFixed(2)}€</div>
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Bordereau #${orderId}</title>
  <style>
    @page { size: A4 portrait; margin: 1cm; }
    body { font-family: Arial, sans-serif; font-size: 14px; color: #000; background: #fff; margin: 0; padding: 20px; }
    h1 { color: #ea580c; font-size: 36px; margin: 0 0 4px; }
    h2 { font-size: 18px; margin: 0 0 4px; }
    .row { display: flex; justify-content: space-between; }
    .section { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #ddd; }
    .label { font-size: 11px; color: #555; }
    .green { color: #16a34a; }
    .tag-delivery { background: #dcfce7; color: #16a34a; padding: 4px 8px; font-weight: bold; display: inline-block; }
    .tag-card { background: #ffedd5; color: #ea580c; padding: 4px 8px; font-weight: bold; display: inline-block; }
    .qr { text-align: center; margin-top: 20px; }
    .footer { text-align: center; font-size: 12px; color: #888; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="row label" style="margin-bottom:20px;">
    <span>AfriGo</span>
    <span>Bordereau - ${orderId}</span>
  </div>

  <div class="section" style="text-align:center; border-bottom:2px solid #ea580c; padding-bottom:16px;">
    <h1>AfriGo</h1>
    <h2>Bordereau de commande #${orderId}</h2>
    <p class="label">Date : ${dateStr}</p>
  </div>

  <div class="section row" style="gap:40px;">
    <div style="flex:1;">
      <b>Client</b><br/>
      <span>${customerName}</span><br/>
      <span class="label">${customer?.customer_id || 'N/A'}</span><br/>
      ${(customer?.phone_number || customer?.phone) ? `<span>📞 ${customer?.phone_number || customer?.phone}</span>` : ''}
    </div>
    <div style="flex:1;">
      <b>Adresse de livraison</b><br/>
      <span>${order?.delivery_address || 'Non spécifiée'}</span><br/>
      <span>${order?.delivery_postal_code || ''} ${order?.delivery_city || ''}</span>
      ${order?.estimated_delivery ? `<div style="margin-top:8px; background:#dcfce7; padding:6px 10px; border-radius:4px; display:inline-block;">
        <b style="color:#16a34a;">📅 Livraison prévue : ${order.estimated_delivery}${order.delivery_time ? ' à ' + order.delivery_time : ''}</b>
      </div>` : ''}
    </div>
  </div>

  <div class="section">
    <b>Articles commandés</b>
    <div style="margin-top:12px;">${itemsHtml}</div>
  </div>

  <div class="section">
    ${(() => {
      const itemsSubtotal = (order?.items || []).reduce((s, i) => s + (i.total_price || 0), 0);
      const deliveryFee = (order?.total_amount || 0) - itemsSubtotal - (order?.promo_discount || 0) + (order?.wallet_amount_used || 0);
      const hasDeliveryFee = deliveryFee > 0.01;
      return `
    <div class="row"><span>Sous-total articles</span><span>${itemsSubtotal.toFixed(2)}€</span></div>
    ${hasDeliveryFee ? `<div class="row"><span>Frais de livraison</span><span>${deliveryFee.toFixed(2)}€</span></div>` : '<div class="row"><span>Frais de livraison</span><span style="color:#16a34a;">Offerts</span></div>'}
    <div class="row" style="margin-top:8px; padding-top:8px; border-top:2px solid #000;"><span><b>Total</b></span><span><b>${order?.total_amount?.toFixed(2)}€</b></span></div>
    ${order?.payment_method === 'delivery' ? `<div class="row"><span><b>Montant restant à régler</b></span><span class="green"><b>${amountToPay}€</b></span></div>` : ''}
      `;
    })()}
  </div>

  <div style="margin-bottom:20px;">
    <p><b>Détails du paiement :</b></p>
    <div style="margin-top:12px; background:#f8f8f8; padding:12px; border-radius:4px;">
      ${order?.payment_method === 'delivery' 
        ? `<div style="margin-bottom:8px;"><span class="tag-delivery">PAIEMENT À LA LIVRAISON</span></div>
           <div style="margin-top:8px; font-size:13px;">Montant total: <b>${order?.total_amount?.toFixed(2)}€</b></div>
           <div style="margin-top:4px; font-size:13px;">Montant à régler: <b class="green">${amountToPay}€</b></div>`
        : `<div style="margin-bottom:8px;"><span class="tag-card">PAIEMENT PAR CARTE</span></div>
           <div style="margin-top:8px; font-size:13px;">Montant total: <b>${order?.total_amount?.toFixed(2)}€</b></div>
           ${order?.wallet_amount_used ? `<div style="margin-top:4px; font-size:13px;">- Portefeuille: <b>-${order.wallet_amount_used?.toFixed(2)}€</b></div>` : ''}
           ${order?.promo_discount ? `<div style="margin-top:4px; font-size:13px;">- Réduction: <b>-${order.promo_discount?.toFixed(2)}€</b></div>` : ''}
           <div style="margin-top:8px; padding-top:8px; border-top:1px solid #ddd; font-size:13px;">Montant débité: <b>${amountToPay}€</b></div>`
      }
    </div>
  </div>

  <div class="qr">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://www.afrigo.app')}" width="150" height="150"/>
    <p class="footer">Scannez ici et passez vos commandes sur l'appli</p>
  </div>
</body>
</html>`;

  const winName = `bordereau_${order?.id}`;
  const win = window.open('', winName, 'width=800,height=900');
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
    win.close();
  };
}

export default function OrderPrintBordereau({ order, users }) {
  const customer = users?.find(u => u.email === order?.customer_email);
  const customerName = customer?.first_name && customer?.last_name
    ? `${customer.first_name} ${customer.last_name}`
    : order?.customer_email;

  const amountToPay = (order?.amount_to_pay || order?.total_amount)?.toFixed(2);

  return (
    <div className="p-8 bg-white text-black text-sm" key={order?.id}>
      {/* Header */}
      <div className="flex justify-between text-xs mb-6">
        <span>AfriGo</span>
        <span>Bordereau - {order?.id.slice(-8).toUpperCase()}</span>
      </div>

      {/* Title */}
      <div className="text-center mb-8 border-b-2 border-orange-500 pb-4">
        <h1 className="text-4xl font-bold text-orange-600 mb-2">AfriGo</h1>
        <h2 className="text-lg font-bold text-gray-800 mb-1">Bordereau de commande #{order?.id.slice(-8).toUpperCase()}</h2>
        <p className="text-sm text-gray-600">Date: {format(new Date(order?.created_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}</p>
      </div>

      {/* Client et Adresse */}
      <div className="flex justify-between gap-12 mb-8 pb-4 border-b">
        <div className="flex-1">
          <h3 className="font-bold text-gray-800 mb-2">Client</h3>
          <p className="text-sm">{customerName}</p>
          <p className="text-sm text-gray-500">{customer?.customer_id || 'N/A'}</p>
          {(customer?.phone_number || customer?.phone) && (
            <p className="text-sm mt-2">📞 {customer.phone_number || customer.phone}</p>
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-800 mb-2">Adresse de livraison</h3>
          <p className="text-sm">{order?.delivery_address || 'Non spécifiée'}</p>
          <p className="text-sm">{order?.delivery_postal_code} {order?.delivery_city || ''}</p>
          {order?.estimated_delivery && (
            <div className="mt-2 inline-block bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded">
              📅 Livraison prévue : {order.estimated_delivery}{order.delivery_time ? ` à ${order.delivery_time}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Articles */}
      <div className="mb-8 pb-4 border-b">
        <h3 className="font-bold text-gray-800 mb-3">Articles commandés</h3>
        <div className="space-y-3">
          {order?.items?.map((item, idx) => (
            <div key={idx} className="pb-3 border-b last:border-0">
              <div className="flex justify-between">
                <p className="font-semibold">{item.product_name}</p>
                <p className="font-semibold">{item.total_price?.toFixed(2)}€</p>
              </div>
              <p className="text-xs text-gray-600">{item.quantity} x {item.unit_price?.toFixed(2)}€</p>
            </div>
          ))}
        </div>
      </div>

      {/* Totaux */}
      <div className="space-y-2 mb-6 pb-4 border-b">
        {(() => {
          const itemsSubtotal = (order?.items || []).reduce((s, i) => s + (i.total_price || 0), 0);
          const deliveryFee = (order?.total_amount || 0) - itemsSubtotal - (order?.promo_discount || 0) + (order?.wallet_amount_used || 0);
          const hasDeliveryFee = deliveryFee > 0.01;
          return (
            <>
              <div className="flex justify-between text-sm">
                <span>Sous-total articles</span>
                <span>{itemsSubtotal.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Frais de livraison</span>
                {hasDeliveryFee
                  ? <span>{deliveryFee.toFixed(2)}€</span>
                  : <span className="text-green-600 font-medium">Offerts</span>
                }
              </div>
              <div className="flex justify-between border-t pt-2 mt-1">
                <span className="font-bold">Total</span>
                <span className="font-bold">{order?.total_amount?.toFixed(2)}€</span>
              </div>
            </>
          );
        })()}
      </div>

      {/* Détails du paiement */}
      <div className="mb-6">
        <p className="font-bold mb-3">Détails du paiement:</p>
        <div className="bg-slate-50 p-3 rounded-lg space-y-2 text-sm">
          <div className={`font-bold px-2 py-1 inline-block ${order?.payment_method === 'delivery' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {order?.payment_method === 'delivery' ? 'PAIEMENT À LA LIVRAISON' : 'PAIEMENT PAR CARTE'}
          </div>
          <div>Montant total: <span className="font-bold">{order?.total_amount?.toFixed(2)}€</span></div>
          {order?.wallet_amount_used > 0 && (
            <div>- Portefeuille: <span className="font-bold">-{order?.wallet_amount_used?.toFixed(2)}€</span></div>
          )}
          {order?.promo_discount > 0 && (
            <div>- Réduction: <span className="font-bold">-{order?.promo_discount?.toFixed(2)}€</span></div>
          )}
          <div className="border-t pt-2 font-bold text-gray-800">
            Montant {order?.payment_method === 'delivery' ? 'à régler' : 'débité'}: <span className={order?.payment_method === 'delivery' ? 'text-green-600' : 'text-orange-600'}>{(order?.amount_to_pay || order?.total_amount)?.toFixed(2)}€</span>
          </div>
        </div>
      </div>

      {/* QR Code */}
      <div className="text-center mb-6">
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://www.afrigo.app')}`} alt="QR" className="w-40 h-40 mx-auto" />
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600">
        <p>Scannez ici et passez vos commandes sur l'appli</p>
      </div>
    </div>
  );
}