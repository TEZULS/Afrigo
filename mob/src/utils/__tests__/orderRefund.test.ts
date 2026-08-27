import {
  canRequestRefund,
  canRequestReturn,
  hasChargedAmount,
  paidByWalletOnly,
  paymentFailed,
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

  it('autorise dans les 2 h après livraison, y compris avec une date serveur sans fuseau', () => {
    expect(
      canRequestReturn({ status: 'delivered', delivered_date: minutesAgo(30) }),
    ).toBe(true);
    // Avant, la date était lue comme locale : avec 2 h de décalage (Paris, été)
    // la fenêtre de 2 h était déjà consommée et le bouton n'apparaissait jamais.
    expect(
      canRequestReturn({ status: 'delivered', updated_date: naiveMinutesAgo(30) }),
    ).toBe(true);
  });

  it('disparaît au-delà du délai (2 h par défaut, ou celui de l’admin)', () => {
    expect(canRequestReturn({ status: 'delivered', delivered_date: hoursAgo(3) })).toBe(false);
    expect(
      canRequestReturn({ status: 'delivered', delivered_date: hoursAgo(3) }, { windowHours: 4 }),
    ).toBe(true);
  });

  it('uniquement pour une commande livrée, une seule fois, avec une date fiable', () => {
    expect(canRequestReturn({ status: 'shipped', updated_date: minutesAgo(5) })).toBe(false);
    expect(
      canRequestReturn({ status: 'delivered', delivered_date: minutesAgo(5) }, { alreadyRequested: true }),
    ).toBe(false);
    expect(canRequestReturn({ status: 'delivered' })).toBe(false);
  });
});
