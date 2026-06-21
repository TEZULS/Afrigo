/**
 * Tests des fonctions métier sur les commandes : éligibilité retour 2h,
 * éligibilité remboursement 24h carte uniquement, mapping statut → onglet
 * remboursement.
 */

interface OrderRow {
  id: string;
  status?: string;
  payment_method?: 'card' | 'delivery' | string;
  payment_status?: string;
  delivered_date?: string;
  updated_date?: string;
  wallet_amount_used?: number;
}

const RETURN_WINDOW_HOURS = 2;
const REFUND_WINDOW_HOURS = 24;

const hoursSince = (iso?: string): number => {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 36e5;
};

/** Réplique de OrdersScreen.canCancel — annulable si pending ou confirmed. */
const canCancel = (o: OrderRow) => o.status === 'pending' || o.status === 'confirmed';

/** Réplique de OrdersScreen.canReturn — livré + < 2h depuis livraison. */
const canReturn = (o: OrderRow, hasReturn = false) => {
  if (o.status !== 'delivered') return false;
  const ref = o.delivered_date ?? o.updated_date;
  if (hoursSince(ref) > RETURN_WINDOW_HOURS) return false;
  return !hasReturn;
};

/**
 * Réplique de OrdersScreen.canRefund — annulé + < 24h + pas de demande
 * existante. Le mode (carte ou wallet) est demandé dans le modal.
 */
const canRefund = (o: OrderRow, hasRefund = false) => {
  if (o.status !== 'cancelled' || hasRefund) return false;
  const ref = o.updated_date ?? o.delivered_date;
  return hoursSince(ref) <= REFUND_WINDOW_HOURS;
};

/** Réplique du STATUS_TO_TAB de MyRefundsScreen. */
const STATUS_TO_TAB = (s?: string): 'pending' | 'approved' | 'refunded' | 'rejected' => {
  if (!s) return 'pending';
  if (s === 'pending') return 'pending';
  if (s === 'approved') return 'approved';
  if (s === 'completed' || s === 'refunded') return 'refunded';
  if (s === 'rejected') return 'rejected';
  return 'pending';
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5).toISOString();

describe('canCancel', () => {
  it('autorise pending et confirmed', () => {
    expect(canCancel({ id: '1', status: 'pending' })).toBe(true);
    expect(canCancel({ id: '1', status: 'confirmed' })).toBe(true);
  });
  it('refuse les autres statuts', () => {
    expect(canCancel({ id: '1', status: 'preparing' })).toBe(false);
    expect(canCancel({ id: '1', status: 'shipped' })).toBe(false);
    expect(canCancel({ id: '1', status: 'delivered' })).toBe(false);
    expect(canCancel({ id: '1', status: 'cancelled' })).toBe(false);
  });
});

describe('canReturn (fenêtre 2h post-livraison)', () => {
  it('autorise dans les 2h après livraison', () => {
    expect(canReturn({ id: '1', status: 'delivered', delivered_date: minutesAgo(30) })).toBe(true);
    expect(canReturn({ id: '1', status: 'delivered', delivered_date: minutesAgo(119) })).toBe(true);
  });
  it('refuse au-delà de 2h', () => {
    expect(canReturn({ id: '1', status: 'delivered', delivered_date: hoursAgo(3) })).toBe(false);
  });
  it('refuse si pas livré', () => {
    expect(canReturn({ id: '1', status: 'shipped', delivered_date: minutesAgo(1) })).toBe(false);
  });
  it("refuse s'il y a déjà une demande de retour", () => {
    expect(
      canReturn({ id: '1', status: 'delivered', delivered_date: minutesAgo(10) }, true),
    ).toBe(false);
  });
});

describe('canRefund (fenêtre 24h, toute commande annulée)', () => {
  it('autorise commande annulée carte dans les 24h', () => {
    expect(
      canRefund({ id: '1', status: 'cancelled', payment_method: 'card', updated_date: hoursAgo(5) }),
    ).toBe(true);
  });
  it('autorise commande annulée à la livraison dans les 24h', () => {
    expect(
      canRefund({
        id: '1',
        status: 'cancelled',
        payment_method: 'delivery',
        updated_date: hoursAgo(1),
      }),
    ).toBe(true);
  });
  it('refuse au-delà de 24h', () => {
    expect(
      canRefund({ id: '1', status: 'cancelled', payment_method: 'card', updated_date: hoursAgo(25) }),
    ).toBe(false);
  });
  it("refuse s'il y a déjà une demande de remboursement", () => {
    expect(
      canRefund(
        { id: '1', status: 'cancelled', payment_method: 'card', updated_date: hoursAgo(1) },
        true,
      ),
    ).toBe(false);
  });
  it('refuse une commande non annulée', () => {
    expect(
      canRefund({ id: '1', status: 'delivered', payment_method: 'card', updated_date: hoursAgo(1) }),
    ).toBe(false);
  });
});

describe('STATUS_TO_TAB (mapping statut remboursement → onglet)', () => {
  it('pending → pending', () => {
    expect(STATUS_TO_TAB('pending')).toBe('pending');
    expect(STATUS_TO_TAB(undefined)).toBe('pending');
  });
  it('approved → approved', () => {
    expect(STATUS_TO_TAB('approved')).toBe('approved');
  });
  it('completed et refunded → refunded', () => {
    expect(STATUS_TO_TAB('completed')).toBe('refunded');
    expect(STATUS_TO_TAB('refunded')).toBe('refunded');
  });
  it('rejected → rejected', () => {
    expect(STATUS_TO_TAB('rejected')).toBe('rejected');
  });
  it('statut inconnu → pending par défaut', () => {
    expect(STATUS_TO_TAB('something_else')).toBe('pending');
  });
});
