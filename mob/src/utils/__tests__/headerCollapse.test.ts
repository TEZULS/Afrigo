import { HEADER_COLLAPSE_DISTANCE, headerCollapseProgress } from '../headerCollapse';

describe('headerCollapseProgress', () => {
  it('reste déplié en haut de liste (et au rebond élastique)', () => {
    expect(headerCollapseProgress(0)).toBe(0);
    expect(headerCollapseProgress(-40)).toBe(0);
  });

  it('se replie proportionnellement au défilement, sans palier', () => {
    expect(headerCollapseProgress(HEADER_COLLAPSE_DISTANCE / 4)).toBeCloseTo(0.25);
    expect(headerCollapseProgress(HEADER_COLLAPSE_DISTANCE / 2)).toBeCloseTo(0.5);
    expect(headerCollapseProgress(HEADER_COLLAPSE_DISTANCE * 0.75)).toBeCloseTo(0.75);
  });

  it('plafonne à 1 une fois complètement replié', () => {
    expect(headerCollapseProgress(HEADER_COLLAPSE_DISTANCE)).toBe(1);
    expect(headerCollapseProgress(4000)).toBe(1);
  });
});
