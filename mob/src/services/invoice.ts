/**
 * Facture PDF d'une commande, générée sur l'appareil.
 *
 * Le bouton « Facture » du détail de commande produit un PDF (expo-print)
 * puis ouvre la feuille de partage / enregistrement du système (expo-sharing)
 * : le client peut l'enregistrer dans Fichiers, l'envoyer par mail, etc.
 * Aucun appel serveur — toutes les données sont déjà dans la commande.
 *
 * Le document reprend la mise en page du bordereau imprimable du web
 * (`OrderDetails.jsx`, version « print-only ») et ajoute le détail
 * HT / TVA / TTC : chaque ligne de `Order.items` porte `vat_rate` (le taux
 * au moment de la commande, `0` pour les produits sans TVA).
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { formatDateTime } from '@/utils/format';
import { round2 } from '@/utils/checkoutMath';
import { computeVatTotals, type VatLine } from '@/utils/cartVat';

export interface InvoiceOrderItem {
  product_name?: string;
  name?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  vat_rate?: number | null;
  selected_variants?: Record<string, { type?: string; value?: string }> | null;
}

export interface InvoiceOrder {
  id: string;
  created_date?: string;
  customer_email?: string;
  items?: InvoiceOrderItem[];
  total_amount?: number;
  promo_code?: string | null;
  promo_discount?: number;
  wallet_amount_used?: number;
  amount_to_pay?: number;
  payment_method?: string;
  delivery_address?: string;
  delivery_postal_code?: string;
  delivery_city?: string;
  estimated_delivery?: string;
  delivery_time?: string;
}

export interface InvoiceCustomer {
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  customer_id?: string;
  phone?: string;
}

/** Numéro court affiché partout dans l'app (`#9B81A19F`). */
export const orderNumber = (order: Pick<InvoiceOrder, 'id'>): string =>
  order.id.slice(-8).toUpperCase();

/** Nom du fichier PDF proposé au client. */
export const invoiceFileName = (order: Pick<InvoiceOrder, 'id'>): string =>
  `Facture-AfriGo-${orderNumber(order)}.pdf`;

const escapeHtml = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Prix en euros, format français (`12,50 €`) — sans `Intl` pour le HTML. */
const euros = (n: number): string => `${round2(n).toFixed(2).replace('.', ',')} €`;

const itemLineTotal = (it: InvoiceOrderItem): number =>
  it.total_price != null ? Number(it.total_price) || 0 : (Number(it.unit_price) || 0) * it.quantity;

const itemUnitPrice = (it: InvoiceOrderItem): number =>
  it.unit_price != null
    ? Number(it.unit_price) || 0
    : it.quantity > 0
      ? itemLineTotal(it) / it.quantity
      : 0;

const customerName = (c?: InvoiceCustomer | null, fallback?: string): string => {
  if (!c) return fallback ?? '';
  const full = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return full || c.full_name || c.email || fallback || '';
};

/**
 * Montants de la commande : sous-total articles TTC, sa décomposition HT /
 * TVA (par taux), frais de livraison déduits du total, remises.
 */
export const invoiceTotals = (order: InvoiceOrder) => {
  const items = order.items ?? [];
  const vatLines: VatLine[] = items.map((it) => ({
    unitPrice: itemUnitPrice(it),
    quantity: it.quantity,
    vatRate: it.vat_rate,
  }));
  const vat = computeVatTotals(vatLines);
  const itemsSubtotal = round2(items.reduce((s, it) => s + itemLineTotal(it), 0));
  const promoDiscount = round2(order.promo_discount ?? 0);
  const walletUsed = round2(order.wallet_amount_used ?? 0);
  const total = round2(order.total_amount ?? 0);
  const deliveryFee = Math.max(0, round2(total - itemsSubtotal));
  const amountToPay = round2(order.amount_to_pay ?? Math.max(0, total - promoDiscount - walletUsed));
  return { itemsSubtotal, vat, promoDiscount, walletUsed, total, deliveryFee, amountToPay };
};

/** HTML complet de la facture (imprimable en A4, pure — testable). */
export const buildInvoiceHtml = (order: InvoiceOrder, customer?: InvoiceCustomer | null): string => {
  const t = invoiceTotals(order);
  const number = orderNumber(order);
  const date = order.created_date ? formatDateTime(order.created_date) : '';
  const items = order.items ?? [];
  const paidByWallet = t.walletUsed > 0 && t.amountToPay === 0;
  const paymentLabel = paidByWallet
    ? 'Portefeuille AfriGo'
    : order.payment_method === 'card'
      ? 'Carte bancaire'
      : 'Paiement à la livraison';

  // Sans TVA sur la commande : ni colonne TVA, ni lignes HT / TVA, ni mention TTC.
  const hasVat = t.vat.vat > 0;
  const rows = items
    .map((it) => {
      const variants = it.selected_variants
        ? Object.values(it.selected_variants)
            .map((v) => [v?.type, v?.value].filter(Boolean).join(' : '))
            .filter(Boolean)
        : [];
      const rate = Number(it.vat_rate) || 0;
      return `
        <tr>
          <td>
            <strong>${escapeHtml(it.product_name ?? it.name ?? 'Article')}</strong>
            ${variants.length ? `<div class="variants">${variants.map(escapeHtml).join(' · ')}</div>` : ''}
          </td>
          <td class="num">${it.quantity}</td>
          <td class="num">${euros(itemUnitPrice(it))}</td>
          ${hasVat ? `<td class="num">${rate ? `${rate} %` : '—'}</td>` : ''}
          <td class="num"><strong>${euros(itemLineTotal(it))}</strong></td>
        </tr>`;
    })
    .join('');

  const vatRows = t.vat.byRate
    .filter((r) => r.rate > 0)
    .map(
      (r) =>
        `<div class="row"><span>TVA ${r.rate} %</span><span>${euros(r.vat)}</span></div>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Facture ${escapeHtml(number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; font-size: 13px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #FF8C00; padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 28px; font-weight: 800; color: #FF8C00; margin: 0; }
  .brand small { display: block; font-size: 11px; color: #64748b; font-weight: 500; margin-top: 2px; }
  .title { text-align: right; }
  .title h2 { margin: 0; font-size: 18px; }
  .title p { margin: 4px 0 0; color: #64748b; font-size: 12px; }
  .cols { display: flex; gap: 24px; margin-bottom: 20px; }
  .col { flex: 1; background: #f8fafc; border-radius: 8px; padding: 12px; }
  .col h3 { margin: 0 0 6px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
  .col p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { text-align: left; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #e2e8f0; padding: 6px 4px; }
  td { padding: 8px 4px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .variants { font-size: 11px; color: #64748b; margin-top: 2px; }
  .totals { margin-left: auto; width: 60%; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; }
  .row.total { border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 800; }
  .row.muted { color: #64748b; }
  .row.green { color: #16a34a; }
  .pay { margin-top: 18px; padding: 10px 12px; background: #ecfdf5; border-radius: 8px; color: #047857; font-weight: 700; display: inline-block; }
  .foot { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <p class="brand">AfriGo<small>Épicerie africaine en ligne</small></p>
    </div>
    <div class="title">
      <h2>Facture n° ${escapeHtml(number)}</h2>
      <p>${escapeHtml(date)}</p>
    </div>
  </div>

  <div class="cols">
    <div class="col">
      <h3>Client</h3>
      <p><strong>${escapeHtml(customerName(customer, order.customer_email))}</strong></p>
      ${customer?.customer_id ? `<p>${escapeHtml(customer.customer_id)}</p>` : ''}
      ${order.customer_email ? `<p>${escapeHtml(order.customer_email)}</p>` : ''}
      ${customer?.phone ? `<p>${escapeHtml(customer.phone)}</p>` : ''}
    </div>
    <div class="col">
      <h3>Livraison</h3>
      <p>${escapeHtml(order.delivery_address ?? '')}</p>
      <p>${escapeHtml([order.delivery_postal_code, order.delivery_city].filter(Boolean).join(' '))}</p>
      ${
        order.estimated_delivery
          ? `<p>Prévue le ${escapeHtml(order.estimated_delivery)}${order.delivery_time ? ` à ${escapeHtml(order.delivery_time)}` : ''}</p>`
          : ''
      }
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Article</th><th class="num">Qté</th><th class="num">P.U.${hasVat ? ' TTC' : ''}</th>${hasVat ? '<th class="num">TVA</th>' : ''}<th class="num">Total${hasVat ? ' TTC' : ''}</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    ${hasVat ? `<div class="row muted"><span>Total HT</span><span>${euros(t.vat.ht)}</span></div>${vatRows}` : ''}
    <div class="row"><span>Sous-total articles${hasVat ? ' TTC' : ''}</span><span>${euros(t.itemsSubtotal)}</span></div>
    <div class="row ${t.deliveryFee > 0.01 ? '' : 'green'}"><span>Frais de livraison</span><span>${t.deliveryFee > 0.01 ? euros(t.deliveryFee) : 'Offerts'}</span></div>
    ${t.promoDiscount > 0 ? `<div class="row green"><span>Code promo${order.promo_code ? ` ${escapeHtml(order.promo_code)}` : ''}</span><span>-${euros(t.promoDiscount)}</span></div>` : ''}
    ${t.walletUsed > 0 ? `<div class="row green"><span>Portefeuille</span><span>-${euros(t.walletUsed)}</span></div>` : ''}
    <div class="row total"><span>Total${hasVat ? ' TTC' : ''}</span><span>${euros(t.total)}</span></div>
    ${
      t.promoDiscount > 0 || t.walletUsed > 0
        ? `<div class="row"><span>Montant réglé</span><span><strong>${euros(t.amountToPay)}</strong></span></div>`
        : ''
    }
  </div>

  <div class="pay">Mode de paiement : ${escapeHtml(paymentLabel)}</div>

  <div class="foot">AfriGo · www.afrigo.app · Merci de votre confiance</div>
</body>
</html>`;
};

/**
 * Génère le PDF et ouvre la feuille de partage du système. Le fichier est
 * renommé `Facture-AfriGo-XXXXXXXX.pdf` pour que l'enregistrement propose un
 * nom parlant plutôt que l'identifiant aléatoire d'expo-print.
 */
export const shareOrderInvoice = async (
  order: InvoiceOrder,
  customer?: InvoiceCustomer | null,
): Promise<void> => {
  const html = buildInvoiceHtml(order, customer);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  let fileUri = uri;
  try {
    const target = new File(Paths.cache, invoiceFileName(order));
    if (target.exists) target.delete();
    new File(uri).move(target);
    fileUri = target.uri;
  } catch {
    // Renommage impossible (système de fichiers restreint) : on partage tel quel.
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Le partage de fichiers n'est pas disponible sur cet appareil.");
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: `Facture ${orderNumber(order)}`,
  });
};
