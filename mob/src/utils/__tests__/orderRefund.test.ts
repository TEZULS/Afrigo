import {
  canRequestRefund,
  canRequestReturn,
  hasChargedAmount,
  hasLockingReturn,
  isOrderPaid,
  paidByWalletOnly,
  paymentFailed,
  RETURN_WINDOW_HOURS,
} from '../orderHelpers';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5).toISOString();

/**
 * Cas réel de production (2026-09-10 → 12) : paiement carte impossible à
 * lancer, commande annulée avec `payment_status: 'failed'`. Le client
 * demandait un remboursement… que l'admin refusait (« aucun montant n'a été
 * débité »).
 */
const failedCardOrder = {
  status: 'cancelled',
  payment_method: 'card',
  payment_status: 'failed',
  wallet_amount_used: 0,
  updated_date: minutesAgo(10),
};

describe('paymentFailed / hasChargedAmount', () => {
  it('reconnaît un paiement échoué ou abandonné', () => {
    expect(paymentFailed({ payment_status: 'failed' })).toBe(true);
    expect(paymentFailed({ payment_status: 'abandoned' })).toBe(true);
    expect(paymentFailed({ payment_status: 'completed' })).toBe(false);
    expect(paymentFailed({})).toBe(false);
  });

  it('aucun montant prélevé quand le paiement a échoué, même avec un portefeuille prévu', () => {
    expect(hasChargedAmount(failedCardOrder)).toBe(false);
    expect(hasChargedAmount({ ...failedCardOrder, wallet_amount_used: 5 })).toBe(false);
  });

  it('montant prélevé : carte aboutie ou portefeuille débité', () => {
    expect(hasChargedAmount({ payment_method: 'card', payment_status: 'completed' })).toBe(true);
    expect(hasChargedAmount({ payment_method: 'delivery', wallet_amount_used: 5 })).toBe(true);
    expect(hasChargedAmount({ payment_method: 'delivery', wallet_amount_used: 0 })).toBe(false);
  });
});

describe('canRequestRefund', () => {
  it('refuse la demande quand le paiement a échoué', () => {
    expect(canRequestRefund(failedCardOrder)).toBe(false);
    expect(canRequestRefund({ ...failedCardOrder, payment_status: 'abandoned' })).toBe(false);
  });

  it('autorise une commande carte payée puis annulée, dans les 24 h', () => {
    expect(
      canRequestRefund({
        status: 'cancelled',
        payment_method: 'card',
        payment_status: 'completed',
        updated_date: hoursAgo(2),
      }),
    ).toBe(true);
  });

  it('autorise une commande à la livraison si le portefeuille a été débité', () => {
    expect(
      canRequestRefund({
        status: 'cancelled',
        payment_method: 'delivery',
        wallet_amount_used: 8,
        updated_date: minutesAgo(30),
      }),
    ).toBe(true);
  });

  it('refuse le paiement à la livraison sans portefeuille (rien prélevé)', () => {
    expect(
      canRequestRefund({ status: 'cancelled', payment_method: 'delivery', updated_date: minutesAgo(30) }),
    ).toBe(false);
  });

  it('refuse au-delà de 24 h, hors annulation, ou si déjà demandé', () => {
    const ok = {
      status: 'cancelled',
      payment_method: 'card',
      payment_status: 'completed',
      updated_date: minutesAgo(30),
    };
    expect(canRequestRefund({ ...ok, updated_date: hoursAgo(25) })).toBe(false);
    expect(canRequestRefund({ ...ok, status: 'delivered' })).toBe(false);
    expect(canRequestRefund(ok, true)).toBe(false);
  });
});

describe('paidByWalletOnly', () => {
  it('détecte une commande entièrement réglée par le portefeuille', () => {
    expect(paidByWalletOnly({ wallet_amount_used: 33.45, amount_to_pay: 0 })).toBe(true);
    expect(paidByWalletOnly({ wallet_amount_used: 20, amount_to_pay: 9.29 })).toBe(false);
    expect(paidByWalletOnly({ wallet_amount_used: 0, amount_to_pay: 0 })).toBe(false);
  });
});

describe('canRequestReturn', () => {
  /** Date serveur sans fuseau (UTC), il y a `m` minutes. */
  const naiveMinutesAgo = (m: number) =>
    new Date(Date.now() - m * 60 * 1000).toISOString().replace('Z', '000');

  it('autorise dans l’heure qui suit la livraison, y compris avec une date serveur sans fuseau', () => {
    expect(RETURN_WINDOW_HOURS).toBe(1);
    expect(
      canRequestReturn({ status: 'delivered', delivered_date: minutesAgo(30) }),
    ).toBe(true);
    // Avant, la date était lue comme locale : avec 2 h de décalage (Paris, été)
    // la fenêtre était déjà consommée et le bouton n'apparaissait jamais.
    expect(
      canRequestReturn({ status: 'delivered', updated_date: naiveMinutesAgo(30) }),
    ).toBe(true);
  });

  it('disparaît une fois l’heure passée (délai surchargeable pour les tests)', () => {
    expect(canRequestReturn({ status: 'delivered', delivered_date: minutesAgo(61) })).toBe(false);
    expect(canRequestReturn({ status: 'delivered', delivered_date: hoursAgo(3) })).toBe(false);
    expect(
      canRequestReturn({ status: 'delivered', delivered_date: hoursAgo(3) }, { windowHours: 4 }),
    ).toBe(true);
  });

  it('uniquement pour une commande livrée, avec une date fiable, tant qu’aucune demande n’est approuvée', () => {
    expect(canRequestReturn({ status: 'shipped', updated_date: minutesAgo(5) })).toBe(false);
    expect(
      canRequestReturn({ status: 'delivered', delivered_date: minutesAgo(5) }, { locked: true }),
    ).toBe(false);
    expect(canRequestReturn({ status: 'delivered' })).toBe(false);
  });
});

describe('hasLockingReturn', () => {
  const returns = [
    { order_id: 'o1', status: 'rejected' },
    { order_id: 'o1', status: 'pending' },
    { order_id: 'o2', status: 'approved' },
    { order_id: 'o3', status: 'completed' },
  ];

  it('laisse le client redemander tant que rien n’est approuvé (refusée ou en attente)', () => {
    expect(hasLockingReturn(returns, 'o1')).toBe(false);
    expect(hasLockingReturn(undefined, 'o1')).toBe(false);
  });

  it('ferme la commande dès qu’une demande est approuvée ou terminée', () => {
    expect(hasLockingReturn(returns, 'o2')).toBe(true);
    expect(hasLockingReturn(returns, 'o3')).toBe(true);
  });
});

describe('isOrderPaid (bouton Facture)', () => {
  it('carte : seulement si le paiement a abouti', () => {
    expect(isOrderPaid({ payment_method: 'card', payment_status: 'completed', status: 'confirmed' })).toBe(true);
    expect(isOrderPaid({ payment_method: 'card', payment_status: 'failed', status: 'cancelled' })).toBe(false);
    expect(isOrderPaid({ payment_method: 'card', payment_status: 'pending', status: 'pending' })).toBe(false);
  });

  it('à la livraison : une fois livrée ; portefeuille intégral : tout de suite', () => {
    expect(isOrderPaid({ payment_method: 'delivery', status: 'delivered' })).toBe(true);
    expect(isOrderPaid({ payment_method: 'delivery', status: 'preparing' })).toBe(false);
    expect(isOrderPaid({ payment_method: 'delivery', status: 'pending', wallet_amount_used: 12, amount_to_pay: 0 })).toBe(true);
  });
});
