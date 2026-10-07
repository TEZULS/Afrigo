import { HEADER_COLLAPSE_DISTANCE, headerCollapseProgress, nextHeaderCollapse } from '../headerCollapse';

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

describe('nextHeaderCollapse — pas de mise en page inutile pendant le défilement', () => {
  it('suit le défilement au pixel près', () => {
    expect(nextHeaderCollapse(0, HEADER_COLLAPSE_DISTANCE / 2)).toBe(0.5);
    expect(nextHeaderCollapse(0.5, HEADER_COLLAPSE_DISTANCE / 2 + 0.3)).toBeNull();
    expect(nextHeaderCollapse(0.5, HEADER_COLLAPSE_DISTANCE / 2 + 1)).toBeCloseTo(37 / 72);
  });

  it('en-tête replié : plus aucune mise à jour pendant tout le reste du défilement', () => {
    expect(nextHeaderCollapse(1, HEADER_COLLAPSE_DISTANCE)).toBeNull();
    expect(nextHeaderCollapse(1, 900)).toBeNull();
    expect(nextHeaderCollapse(1, 4000)).toBeNull();
  });

  it('en haut de liste (et rebond) : rien à faire une fois déplié', () => {
    expect(nextHeaderCollapse(0, 0)).toBeNull();
    expect(nextHeaderCollapse(0, -40)).toBeNull();
    expect(nextHeaderCollapse(1, 0)).toBe(0);
  });
});
