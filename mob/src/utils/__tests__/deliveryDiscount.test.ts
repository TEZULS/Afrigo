import {
  deliveryDiscountPercent,
  discountDependsOnOrderNumber,
  discountedDeliveryFee,
} from '../deliveryDiscount';

const today = '2026-09-28';
const ctx = (orderNumber: number, tier = 'normal') => ({ orderNumber, tier, today });

describe('deliveryDiscountPercent', () => {
  it('applique le pourcentage de la zone à toutes les commandes (réglage de la zone 4 en production)', () => {
    const zone4 = {
      delivery_discount_percentage: 100,
      discount_valid_from: null,
      discount_valid_until: null,
      discount_for_order_numbers: [],
      discount_for_new_customers: false,
      tier_discounts: { normal: 0, argent: 0, or: 0, diamant: 0 },
    };
    expect(deliveryDiscountPercent(zone4, ctx(1))).toBe(100);
    expect(deliveryDiscountPercent(zone4, ctx(7))).toBe(100);
  });

  it('respecte la période de validité (bornes incluses, vides = sans limite)', () => {
    const zone = { delivery_discount_percentage: 50, discount_valid_from: '2026-09-28', discount_valid_until: '' };
    expect(deliveryDiscountPercent(zone, ctx(1))).toBe(50);
    expect(deliveryDiscountPercent({ ...zone, discount_valid_from: '2026-09-29' }, ctx(1))).toBe(0);
    expect(deliveryDiscountPercent({ ...zone, discount_valid_until: '2026-09-27' }, ctx(1))).toBe(0);
  });

  it('ne s’applique qu’aux numéros de commande choisis (1re, 2e…)', () => {
    const zone = { delivery_discount_percentage: 30, discount_for_order_numbers: [1, 3] };
    expect(deliveryDiscountPercent(zone, ctx(1))).toBe(30);
    expect(deliveryDiscountPercent(zone, ctx(2))).toBe(0);
    expect(deliveryDiscountPercent(zone, ctx(3))).toBe(30);
    expect(discountDependsOnOrderNumber(zone)).toBe(true);
  });

  it('nouveaux clients : première commande uniquement', () => {
    const zone = { delivery_discount_percentage: 100, discount_for_new_customers: true };
    expect(deliveryDiscountPercent(zone, ctx(1))).toBe(100);
    expect(deliveryDiscountPercent(zone, ctx(2))).toBe(0);
    expect(discountDependsOnOrderNumber(zone)).toBe(true);
  });

  it('ajoute le bonus du niveau client, plafonné à 100 %', () => {
    const zone = { delivery_discount_percentage: 20, tier_discounts: { normal: 0, or: 15, diamant: 90 } };
    expect(deliveryDiscountPercent(zone, ctx(1, 'or'))).toBe(35);
    expect(deliveryDiscountPercent(zone, ctx(1, 'diamant'))).toBe(100);
    expect(deliveryDiscountPercent(zone, ctx(1))).toBe(20);
    expect(deliveryDiscountPercent(null, ctx(1))).toBe(0);
  });
});

describe('discountedDeliveryFee', () => {
  it('arrondit au centime', () => {
    expect(discountedDeliveryFee(4.99, 100)).toBe(0);
    expect(discountedDeliveryFee(4.99, 50)).toBe(2.5);
    expect(discountedDeliveryFee(6.9, 0)).toBe(6.9);
  });
});
