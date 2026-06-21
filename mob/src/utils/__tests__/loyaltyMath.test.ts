/**
 * Tests de la conversion des points de fidélité en euros (logique du
 * ProfileScreen.handleConvertPoints).
 */

interface LoyaltyTx {
  points?: number;
}

const totalPoints = (rows: LoyaltyTx[]): number =>
  Math.max(0, rows.reduce((sum, p) => sum + (p.points || 0), 0));

const computeConversion = (rows: LoyaltyTx[], conversionRate: number) => {
  const total = totalPoints(rows);
  if (total < conversionRate) {
    return { eligible: false, euroAmount: 0, pointsToConvert: 0, remainingPoints: total };
  }
  const euroAmount = Math.floor(total / conversionRate);
  const pointsToConvert = euroAmount * conversionRate;
  const remainingPoints = total - pointsToConvert;
  return { eligible: true, euroAmount, pointsToConvert, remainingPoints };
};

describe('totalPoints', () => {
  it('somme les transactions', () => {
    expect(totalPoints([{ points: 5 }, { points: 3 }, { points: 2 }])).toBe(10);
  });
  it('soustrait les conversions (points négatifs)', () => {
    expect(totalPoints([{ points: 100 }, { points: -50 }])).toBe(50);
  });
  it('plancher à 0 (pas de solde négatif)', () => {
    expect(totalPoints([{ points: 10 }, { points: -50 }])).toBe(0);
  });
  it('liste vide → 0', () => {
    expect(totalPoints([])).toBe(0);
  });
  it('ignore les rows sans points', () => {
    expect(totalPoints([{ points: 5 }, {}, { points: 3 }])).toBe(8);
  });
});

describe('computeConversion (1pt = 1€ par défaut)', () => {
  it('non éligible si moins que conversionRate', () => {
    const r = computeConversion([{ points: 49 }], 50);
    expect(r.eligible).toBe(false);
    expect(r.euroAmount).toBe(0);
  });

  it('100 points à 50pts/€ → 2€', () => {
    const r = computeConversion([{ points: 100 }], 50);
    expect(r.eligible).toBe(true);
    expect(r.euroAmount).toBe(2);
    expect(r.pointsToConvert).toBe(100);
    expect(r.remainingPoints).toBe(0);
  });

  it('1pt = 1€ (taux par défaut), 25 points → 25€', () => {
    const r = computeConversion([{ points: 25 }], 1);
    expect(r.eligible).toBe(true);
    expect(r.euroAmount).toBe(25);
    expect(r.pointsToConvert).toBe(25);
    expect(r.remainingPoints).toBe(0);
  });

  it('117 points à 50pts/€ → 2€ converti, 17 restants', () => {
    const r = computeConversion([{ points: 117 }], 50);
    expect(r.eligible).toBe(true);
    expect(r.euroAmount).toBe(2);
    expect(r.pointsToConvert).toBe(100);
    expect(r.remainingPoints).toBe(17);
  });

  it('après conversion, le solde tombe à 0 (cas user demandé)', () => {
    // Le user a 50 points, taux 50pts/€ → convertit tout
    const before = [{ points: 50 }];
    const after = [...before, { points: -50 }];
    expect(totalPoints(before)).toBe(50);
    expect(totalPoints(after)).toBe(0);
  });
});
