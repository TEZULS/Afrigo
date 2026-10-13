import {
  MIN_RETURN_PHOTOS,
  RETURN_STEPS,
  returnReasonLabel,
  returnResolutionLabel,
  returnStatusLabel,
  returnStepIndex,
} from '../returnStatus';

describe('returnStatus', () => {
  it('suit les trois étapes En attente → Approuvé → Terminé', () => {
    expect(RETURN_STEPS.map((s) => s.label)).toEqual(['En attente', 'Approuvé', 'Terminé']);
    expect(returnStepIndex('pending')).toBe(0);
    expect(returnStepIndex('approved')).toBe(1);
    expect(returnStepIndex('completed')).toBe(2);
  });

  it('place une demande refusée hors du suivi et un statut inconnu au départ', () => {
    expect(returnStepIndex('rejected')).toBe(-1);
    expect(returnStepIndex(undefined)).toBe(0);
    expect(returnStepIndex('n_importe_quoi')).toBe(0);
  });

  it('traduit statuts, motifs et résolutions comme le web', () => {
    expect(returnStatusLabel('pending')).toBe('En attente');
    expect(returnStatusLabel('rejected')).toBe('Refusé');
    expect(returnStatusLabel(null)).toBe('En attente');
    expect(returnReasonLabel('wrong_product')).toBe('Mauvais produit');
    expect(returnReasonLabel('expired')).toBe('Date expirée');
    expect(returnReasonLabel('')).toBe('—');
    expect(returnResolutionLabel('exchange')).toBe('Échange du produit');
    expect(returnResolutionLabel('refund')).toBe('Remboursement sur le portefeuille');
    expect(returnResolutionLabel(undefined)).toBe('—');
  });

  it('exige au moins deux photos prises en direct', () => {
    expect(MIN_RETURN_PHOTOS).toBe(2);
  });
});

describe('returnReasonLabel — anciennes demandes « Produit abîmé »', () => {
  it('affiche toujours la mention des anciennes demandes', () => {
    expect(returnReasonLabel('wrong_product', 'Produit abîmé — Emballage écrasé')).toBe('Produit abîmé');
    expect(returnReasonLabel('wrong_product', 'Pas le bon lot')).toBe('Mauvais produit');
  });
});
