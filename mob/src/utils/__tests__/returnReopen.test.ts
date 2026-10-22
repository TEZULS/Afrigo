import { canRequestReturn, hasLockingReturn } from '../orderHelpers';
import {
  RETURN_REASONS,
  isRefundResolution,
  returnResolutionLabel,
  returnStatusDescription,
} from '../returnStatus';
import { missedDeliveriesOf, missedDeliveryLabel } from '../missedDeliveries';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

describe('réclamation réactivée par l’admin (Order.return_request_reopened)', () => {
  it('plus de délai d’une heure une fois réactivée', () => {
    expect(canRequestReturn({ status: 'delivered', delivered_date: hoursAgo(30) })).toBe(false);
    expect(canRequestReturn({ status: 'delivered', delivered_date: hoursAgo(30), return_request_reopened: true })).toBe(true);
  });

  it('toujours réservée aux commandes livrées', () => {
    expect(canRequestReturn({ status: 'shipped', return_request_reopened: true })).toBe(false);
  });

  it('réactivée : seule une réclamation en cours (approuvée) bloque, comme sur le site', () => {
    const done = [{ order_id: 'o1', status: 'completed' }];
    const running = [{ order_id: 'o1', status: 'approved' }];
    expect(hasLockingReturn(done, 'o1')).toBe(true);
    expect(hasLockingReturn(done, 'o1', { reopened: true })).toBe(false);
    expect(hasLockingReturn(running, 'o1', { reopened: true })).toBe(true);
  });
});

describe('résolution « Garder le produit + remboursement »', () => {
  it('libellé, remboursement et phrase de suivi', () => {
    expect(returnResolutionLabel('refund_keep')).toBe('Garder le produit + remboursement');
    expect(isRefundResolution('refund_keep')).toBe(true);
    expect(isRefundResolution('exchange')).toBe(false);
    expect(returnStatusDescription('approved', 'refund_keep')).toMatch(/vous gardez le produit/);
    expect(returnStatusDescription('approved', 'refund')).toMatch(/le livreur passera/);
  });

  it('« Produit abîmé » n’est plus proposé', () => {
    expect(RETURN_REASONS.map((r) => r.label)).toEqual(['Mauvais produit', 'Date expirée']);
  });
});

describe('livraisons manquées', () => {
  it('libellés du site et lecture tolérante', () => {
    expect(missedDeliveryLabel(0)).toBe('1ère livraison manquée');
    expect(missedDeliveryLabel(1)).toBe('2ème livraison manquée');
    expect(missedDeliveriesOf({ missed_deliveries: [{ reason: 'Client absent' }, null] })).toEqual([{ reason: 'Client absent' }]);
    expect(missedDeliveriesOf({})).toEqual([]);
  });
});
