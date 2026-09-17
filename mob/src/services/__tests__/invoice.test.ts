const mockPrintToFileAsync = jest.fn(async (_opts?: unknown) => ({ uri: 'file:///cache/Print-abc.pdf' }));
const mockShareAsync = jest.fn(async (_url?: unknown, _opts?: unknown) => {});
const mockIsAvailableAsync = jest.fn(async () => true);
const mockMove = jest.fn();
const mockDelete = jest.fn();

jest.mock('expo-print', () => ({ printToFileAsync: (opts: unknown) => mockPrintToFileAsync(opts) }));
jest.mock('expo-sharing', () => ({
  shareAsync: (url: unknown, opts: unknown) => mockShareAsync(url, opts),
  isAvailableAsync: () => mockIsAvailableAsync(),
}));
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    exists = false;
    constructor(...parts: unknown[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
    }
    move(target: File) {
      mockMove(this.uri, target.uri);
    }
    delete() {
      mockDelete(this.uri);
    }
  }
  return { File, Paths: { cache: { uri: 'file:///cache' } } };
});

import { buildInvoiceHtml, invoiceFileName, invoiceTotals, shareOrderInvoice } from '../invoice';

/** Commande réelle du 2026-09-16 (#490F8503) : deux produits sans TVA, un à 10 %. */
const order = {
  id: '6aaa64ca37afea24490f8503',
  created_date: '2026-09-16T09:43:38.349000',
  customer_email: 'beauty13home@gmail.com',
  payment_method: 'delivery',
  total_amount: 40.23,
  amount_to_pay: 40.23,
  promo_discount: 0,
  wallet_amount_used: 0,
  delivery_address: '37 Rue Lecourbe',
  delivery_postal_code: '75015',
  delivery_city: 'Paris',
  items: [
    { product_name: 'Poisson ', quantity: 1, unit_price: 20.99, total_price: 20.99, vat_rate: 0 },
    { product_name: 'Adja', quantity: 1, unit_price: 4.25, total_price: 4.25, vat_rate: 0 },
    {
      product_name: 'Crabe Madagascar 1Kg',
      quantity: 1,
      unit_price: 10,
      total_price: 10,
      vat_rate: 10,
      selected_variants: { single: { type: 'poids', value: '1kg' } },
    },
  ],
};

describe('invoice', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calcule HT / TVA / TTC et les frais de livraison déduits du total', () => {
    const t = invoiceTotals(order);
    expect(t.itemsSubtotal).toBe(35.24);
    expect(t.vat.ht).toBe(34.33);
    expect(t.vat.vat).toBe(0.91);
    expect(t.vat.byRate.map((r) => r.rate)).toEqual([0, 10]);
    expect(t.deliveryFee).toBe(4.99);
    expect(t.total).toBe(40.23);
  });

  it('produit un HTML complet avec les lignes, la TVA par taux et le total TTC', () => {
    const html = buildInvoiceHtml(order, { first_name: 'Samy', last_name: 'K.', customer_id: 'AFG-0042' });
    expect(html).toContain('Facture n° 490F8503');
    expect(html).toContain('Samy K.');
    expect(html).toContain('AFG-0042');
    expect(html).toContain('Crabe Madagascar 1Kg');
    expect(html).toContain('poids : 1kg');
    expect(html).toContain('<span>Total HT</span><span>34,33 €</span>');
    expect(html).toContain('<span>TVA 10 %</span><span>0,91 €</span>');
    expect(html).toContain('<span>Sous-total articles TTC</span><span>35,24 €</span>');
    expect(html).toContain('<span>Frais de livraison</span><span>4,99 €</span>');
    expect(html).toContain('<span>Total TTC</span><span>40,23 €</span>');
    expect(html).toContain('Paiement à la livraison');
  });

  it('échappe le HTML des données client et affiche « Offerts » sans frais', () => {
    const html = buildInvoiceHtml(
      {
        ...order,
        total_amount: 35.24,
        amount_to_pay: 35.24,
        delivery_address: '<script>alert(1)</script>',
      },
      null,
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<span>Frais de livraison</span><span>Offerts</span>');
    // Sans client fourni, l'email de la commande sert de nom.
    expect(html).toContain('<strong>beauty13home@gmail.com</strong>');
  });

  it('mentionne le portefeuille quand il règle toute la commande', () => {
    const html = buildInvoiceHtml({
      ...order,
      payment_method: 'delivery',
      wallet_amount_used: 40.23,
      amount_to_pay: 0,
    });
    expect(html).toContain('Portefeuille AfriGo');
    expect(html).toContain('<span>Portefeuille</span><span>-40,23 €</span>');
  });

  it('génère le PDF, le renomme et ouvre la feuille de partage', async () => {
    await shareOrderInvoice(order, { email: 'beauty13home@gmail.com' });

    expect(mockPrintToFileAsync).toHaveBeenCalledWith(
      expect.objectContaining({ html: expect.stringContaining('Facture n° 490F8503') }),
    );
    expect(invoiceFileName(order)).toBe('Facture-AfriGo-490F8503.pdf');
    expect(mockMove).toHaveBeenCalledWith(
      'file:///cache/Print-abc.pdf',
      'file:///cache/Facture-AfriGo-490F8503.pdf',
    );
    expect(mockShareAsync).toHaveBeenCalledWith(
      'file:///cache/Facture-AfriGo-490F8503.pdf',
      expect.objectContaining({ mimeType: 'application/pdf', UTI: 'com.adobe.pdf' }),
    );
  });

  it('partage le fichier tel quel si le renommage échoue', async () => {
    mockMove.mockImplementationOnce(() => {
      throw new Error('EPERM');
    });
    await shareOrderInvoice(order);
    expect(mockShareAsync).toHaveBeenCalledWith('file:///cache/Print-abc.pdf', expect.anything());
  });

  it('remonte une erreur lisible quand le partage est indisponible', async () => {
    mockIsAvailableAsync.mockResolvedValueOnce(false);
    await expect(shareOrderInvoice(order)).rejects.toThrow(/partage de fichiers/);
    expect(mockShareAsync).not.toHaveBeenCalled();
  });
});

describe('facture sans TVA', () => {
  it('omet la colonne TVA, les lignes HT / TVA et la mention TTC', () => {
    const html = buildInvoiceHtml({
      id: 'ord_notax_00000001',
      created_date: '2026-09-16T10:00:00.000000',
      payment_method: 'delivery',
      total_amount: 8.5,
      items: [{ product_name: 'Adja', quantity: 2, unit_price: 4.25, vat_rate: 0 }],
    });
    expect(html).not.toContain('Total HT');
    expect(html).not.toContain('<th class="num">TVA</th>');
    expect(html).not.toContain('TTC');
    expect(html).toContain('<span>Total</span><span>8,50 €</span>');
  });
});
