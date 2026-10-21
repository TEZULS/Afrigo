import { kv } from '@/services/storage';
import {
  CAMERA_RESUME_WINDOW_MS,
  RETURN_DRAFT_KEY,
  RETURN_DRAFT_TTL_MS,
  clearReturnDraft,
  readReturnDraft,
  returnDraftAwaitingCamera,
  saveReturnDraft,
} from '../returnDraft';

const base = {
  orderId: 'ord_1',
  email: 'Salma@X.fr',
  selected: { '0': 2 },
  reasonCode: 'expired',
  description: 'Périmé',
  photos: [{ uri: 'file:///a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' }],
};

describe('brouillon de réclamation', () => {
  beforeEach(() => kv.remove(RETURN_DRAFT_KEY));

  it('repris pour la même commande et le même compte (casse de l’e-mail ignorée)', () => {
    saveReturnDraft(base, 1000);
    expect(readReturnDraft('ord_1', 'salma@x.fr', 2000)).toMatchObject({
      selected: { '0': 2 },
      reasonCode: 'expired',
      description: 'Périmé',
      photos: [{ uri: 'file:///a.jpg' }],
    });
  });

  it('jamais pour une autre commande, un autre compte, ou après une heure', () => {
    saveReturnDraft(base, 1000);
    expect(readReturnDraft('ord_2', 'salma@x.fr', 2000)).toBeNull();
    expect(readReturnDraft('ord_1', 'autre@x.fr', 2000)).toBeNull();
    expect(readReturnDraft('ord_1', null, 2000)).toBeNull();
    expect(readReturnDraft('ord_1', 'salma@x.fr', 1000 + RETURN_DRAFT_TTL_MS + 1)).toBeNull();
  });

  it('effacé seulement pour sa commande quand elle est précisée', () => {
    saveReturnDraft(base);
    clearReturnDraft('ord_2');
    expect(readReturnDraft('ord_1', 'salma@x.fr')).not.toBeNull();
    clearReturnDraft('ord_1');
    expect(readReturnDraft('ord_1', 'salma@x.fr')).toBeNull();
  });

  it('réouverture au démarrage : seulement si l’appareil photo venait d’être ouvert', () => {
    saveReturnDraft(base, 1000);
    expect(returnDraftAwaitingCamera('salma@x.fr', 2000)).toBeNull();
    saveReturnDraft({ ...base, cameraOpenedAt: 1000 }, 1000);
    expect(returnDraftAwaitingCamera('salma@x.fr', 1000 + 60_000)?.orderId).toBe('ord_1');
    expect(returnDraftAwaitingCamera('autre@x.fr', 1000 + 60_000)).toBeNull();
    expect(returnDraftAwaitingCamera('salma@x.fr', 1000 + CAMERA_RESUME_WINDOW_MS)).toBeNull();
  });

  it('valeur abîmée sur le téléphone : ignorée sans planter', () => {
    kv.set(RETURN_DRAFT_KEY, 'n’importe quoi');
    expect(readReturnDraft('ord_1', 'salma@x.fr')).toBeNull();
    expect(returnDraftAwaitingCamera('salma@x.fr')).toBeNull();
    kv.set(RETURN_DRAFT_KEY, { orderId: 'ord_1', email: 'salma@x.fr', savedAt: Date.now(), photos: 'x' });
    expect(readReturnDraft('ord_1', 'salma@x.fr')).toMatchObject({
      selected: {},
      reasonCode: '',
      description: '',
      photos: [],
    });
  });
});
