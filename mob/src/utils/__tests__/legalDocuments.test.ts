import {
  activePrivacyPolicy,
  activeRegulations,
  displayableRegulations,
  parseLegalContent,
  privacyAccepted,
  regulationsAccepted,
  splitBold,
} from '../legalDocuments';

describe('documents légaux — sélection', () => {
  const regs = [
    { id: 'r1', version: 1, is_active: false, updated_date: '2026-05-12T10:00:00.000000' },
    { id: 'r2', version: 2, is_active: true, updated_date: '2026-06-01T10:00:00.000000' },
    { id: 'r3', version: 3, is_active: false, updated_date: '2026-07-01T10:00:00.000000' },
  ];

  it('règlement à accepter = actif de plus haute version ; à afficher = actif sinon le plus récent', () => {
    expect(activeRegulations(regs)?.id).toBe('r2');
    expect(displayableRegulations(regs)?.id).toBe('r2');
    expect(activeRegulations(regs.map((r) => ({ ...r, is_active: false })))).toBeNull();
    expect(displayableRegulations(regs.map((r) => ({ ...r, is_active: false })))?.id).toBe('r3');
  });

  it('politique active', () => {
    expect(activePrivacyPolicy([{ id: 'p1', version: '1.0', is_active: false }])).toBeNull();
    expect(activePrivacyPolicy([{ id: 'p1', version: '1.0', is_active: true }])?.id).toBe('p1');
  });
});

describe('documents légaux — acceptation', () => {
  const reg = { id: 'r2', version: 2, is_active: true };

  it('règlement : même identifiant et même version, sinon à redemander', () => {
    expect(regulationsAccepted(reg, { regulationId: 'r2', regulationVersion: 2, acceptedAt: 'x' })).toBe(true);
    expect(regulationsAccepted(reg, { regulationId: 'r2', regulationVersion: 1, acceptedAt: 'x' })).toBe(false);
    expect(regulationsAccepted(reg, { regulationId: 'r1', regulationVersion: 2, acceptedAt: 'x' })).toBe(false);
    expect(regulationsAccepted(reg, null)).toBe(false);
    expect(regulationsAccepted(null, null)).toBe(true);
  });

  it('politique : version du profil, sinon acceptation locale', () => {
    const policy = { id: 'p1', version: '1.0', is_active: true };
    expect(privacyAccepted(policy, '1.0', null)).toBe(true);
    expect(privacyAccepted(policy, '0.9', null)).toBe(false);
    expect(privacyAccepted(policy, null, { version: '1.0', acceptedAt: 'x' })).toBe(true);
    expect(privacyAccepted(policy, null, null)).toBe(false);
    expect(privacyAccepted(null, null, null)).toBe(true);
  });
});

describe('documents légaux — rendu', () => {
  it('découpe le Markdown du règlement en titres, paragraphes, puces et règles', () => {
    const blocks = parseLegalContent(
      '# Règlement Intérieur AfriGo\n\n**Date : 20/04/2026**\n\n---\n\n## 1. PRÉSENTATION\n\nAfriGo est une plateforme\nde commerce.\n\n- Premier point\n- Second point\n',
    );
    expect(blocks).toEqual([
      { type: 'heading', level: 1, text: 'Règlement Intérieur AfriGo' },
      { type: 'paragraph', text: '**Date : 20/04/2026**' },
      { type: 'rule' },
      { type: 'heading', level: 2, text: '1. PRÉSENTATION' },
      { type: 'paragraph', text: 'AfriGo est une plateforme de commerce.' },
      { type: 'bullet', text: 'Premier point' },
      { type: 'bullet', text: 'Second point' },
    ]);
  });

  it('nettoie le HTML éventuel et gère le gras', () => {
    expect(parseLegalContent('<p>Bonjour &amp; bienvenue</p><br>Suite')).toEqual([
      { type: 'paragraph', text: 'Bonjour & bienvenue' },
      { type: 'paragraph', text: 'Suite' },
    ]);
    expect(splitBold('Date : **20/04/2026** fin')).toEqual([
      { text: 'Date : ', bold: false },
      { text: '20/04/2026', bold: true },
      { text: ' fin', bold: false },
    ]);
  });
});

describe('parseLegalContent — texte brut de la politique de confidentialité', () => {
  const raw =
    'POLITIQUE DE CONFIDENTIALITÉ\n\nDernière mise à jour : 18/04/2026\n\n1. COLLECTE DES DONNÉES\nNous collectons les informations que vous nous fournissez.\n\n2. UTILISATION DES DONNÉES\n- Traiter vos commandes';

  it('masque la ligne « Dernière mise à jour »', () => {
    const texts = parseLegalContent(raw).map((b) => ('text' in b ? b.text : ''));
    expect(texts.some((t) => /mise à jour/i.test(t))).toBe(false);
  });

  it('fait des lignes en capitales des titres, séparés de leur paragraphe', () => {
    expect(parseLegalContent(raw)).toEqual([
      { type: 'heading', level: 2, text: 'POLITIQUE DE CONFIDENTIALITÉ' },
      { type: 'heading', level: 3, text: '1. COLLECTE DES DONNÉES' },
      { type: 'paragraph', text: 'Nous collectons les informations que vous nous fournissez.' },
      { type: 'heading', level: 3, text: '2. UTILISATION DES DONNÉES' },
      { type: 'bullet', text: 'Traiter vos commandes' },
    ]);
  });
});
