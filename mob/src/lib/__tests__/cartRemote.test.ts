/**
 * Tests des fonctions de sync panier distant. Vérifient les bonnes
 * primitives Base44 (filter/create/update/delete) en fonction des cas.
 */
import {
  remoteUpsertAfterAdd,
  remoteDecrementAfterRemove,
  remoteDeleteLine,
  remoteSetQuantity,
} from '../cartRemote';
import { getBase44 } from '@/api/base44Client';

const cartItemEntity = () =>
  (getBase44() as unknown as {
    entities: {
      CartItem: { filter: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    };
  }).entities.CartItem;

beforeEach(() => {
  const ci = cartItemEntity();
  ci.filter.mockClear();
  ci.create.mockClear();
  ci.update.mockClear();
  ci.delete.mockClear();
  ci.filter.mockResolvedValue([]);
  ci.create.mockResolvedValue({ id: 'srv1' });
  ci.update.mockResolvedValue({});
  ci.delete.mockResolvedValue({});
});

describe('remoteUpsertAfterAdd', () => {
  it('crée une nouvelle ligne si rien côté serveur', async () => {
    await remoteUpsertAfterAdd('user@x.fr', {
      productId: 'p1',
      name: 'Pklo',
      unitPrice: 4.99,
    });
    const ci = cartItemEntity();
    expect(ci.create).toHaveBeenCalledTimes(1);
    expect(ci.update).not.toHaveBeenCalled();
  });

  it('met à jour la ligne existante (mêmes variants)', async () => {
    cartItemEntity().filter.mockResolvedValue([
      { id: 'a', quantity: 5, selected_variants: null },
    ]);
    await remoteUpsertAfterAdd('user@x.fr', {
      productId: 'p1',
      name: 'Pklo',
      unitPrice: 4.99,
    });
    const ci = cartItemEntity();
    expect(ci.update).toHaveBeenCalledWith('a', { quantity: 6 });
  });

  it("ajoute la quantité passée explicitement", async () => {
    cartItemEntity().filter.mockResolvedValue([
      { id: 'a', quantity: 3, selected_variants: null },
    ]);
    await remoteUpsertAfterAdd('u@x.fr', {
      productId: 'p1',
      name: 'A',
      unitPrice: 5,
      quantity: 4,
    });
    expect(cartItemEntity().update).toHaveBeenCalledWith('a', { quantity: 7 });
  });

  it('distingue les variants différents (crée une nouvelle ligne)', async () => {
    cartItemEntity().filter.mockResolvedValue([
      {
        id: 'a',
        quantity: 1,
        selected_variants: { choice: { type: 'size', value: 'S' } },
      },
    ]);
    await remoteUpsertAfterAdd('u@x.fr', {
      productId: 'p1',
      name: 'A',
      unitPrice: 5,
      variant: { type: 'size', value: 'M' },
    });
    expect(cartItemEntity().create).toHaveBeenCalled();
    expect(cartItemEntity().update).not.toHaveBeenCalled();
  });

  it('crée la ligne avec le format `selected_variants` attendu par base44', async () => {
    cartItemEntity().filter.mockResolvedValue([]);
    const variant = { type: 'poids', value: '500g', price_modifier: 2.49 };
    await remoteUpsertAfterAdd('u@x.fr', {
      productId: 'p1',
      name: 'A',
      unitPrice: 7.49,
      variant,
    });
    expect(cartItemEntity().create).toHaveBeenCalledWith(
      expect.objectContaining({ selected_variants: { single: variant } }),
    );
  });

  /*
    Une ligne créée par l'ancienne version du mobile (clé `choice`) ou par le
    web (clé `single`) désigne la même variante : on incrémente au lieu de
    créer un doublon.
  */
  it('incrémente une ligne existante quelle que soit la clé utilisée', async () => {
    cartItemEntity().filter.mockResolvedValue([
      { id: 'a', quantity: 2, selected_variants: { choice: { type: 'poids', value: '500g' } } },
    ]);
    await remoteUpsertAfterAdd('u@x.fr', {
      productId: 'p1',
      name: 'A',
      unitPrice: 7.49,
      variant: { type: 'poids', value: '500g', price_modifier: 2.49 },
    });
    expect(cartItemEntity().update).toHaveBeenCalledWith('a', { quantity: 3 });
    expect(cartItemEntity().create).not.toHaveBeenCalled();
  });
});

describe('remoteDecrementAfterRemove', () => {
  it('décrémente quand quantity > 1', async () => {
    cartItemEntity().filter.mockResolvedValue([
      { id: 'a', quantity: 3, selected_variants: null },
    ]);
    await remoteDecrementAfterRemove('u@x.fr', 'p1');
    expect(cartItemEntity().update).toHaveBeenCalledWith('a', { quantity: 2 });
    expect(cartItemEntity().delete).not.toHaveBeenCalled();
  });

  it("supprime quand quantity = 1", async () => {
    cartItemEntity().filter.mockResolvedValue([
      { id: 'a', quantity: 1, selected_variants: null },
    ]);
    await remoteDecrementAfterRemove('u@x.fr', 'p1');
    expect(cartItemEntity().delete).toHaveBeenCalledWith('a');
  });

  it('ne fait rien si la ligne est introuvable', async () => {
    await remoteDecrementAfterRemove('u@x.fr', 'p1');
    expect(cartItemEntity().update).not.toHaveBeenCalled();
    expect(cartItemEntity().delete).not.toHaveBeenCalled();
  });
});

describe('remoteDeleteLine', () => {
  it('supprime la ligne quand elle existe', async () => {
    cartItemEntity().filter.mockResolvedValue([{ id: 'a', selected_variants: null }]);
    await remoteDeleteLine('u@x.fr', 'p1');
    expect(cartItemEntity().delete).toHaveBeenCalledWith('a');
  });

  it("ne fait rien si la ligne n'existe pas", async () => {
    await remoteDeleteLine('u@x.fr', 'p1');
    expect(cartItemEntity().delete).not.toHaveBeenCalled();
  });
});

describe('remoteSetQuantity', () => {
  it('crée la ligne si elle n\'existe pas', async () => {
    await remoteSetQuantity('u@x.fr', 'p1', 5, {
      name: 'A',
      unitPrice: 4,
    });
    expect(cartItemEntity().create).toHaveBeenCalled();
  });

  it("met à jour la quantité d'une ligne existante", async () => {
    cartItemEntity().filter.mockResolvedValue([
      { id: 'a', quantity: 3, selected_variants: null },
    ]);
    await remoteSetQuantity('u@x.fr', 'p1', 9, { name: 'A', unitPrice: 4 });
    expect(cartItemEntity().update).toHaveBeenCalledWith('a', { quantity: 9 });
  });

  it('supprime si quantity ≤ 0 ET ligne existante', async () => {
    cartItemEntity().filter.mockResolvedValue([
      { id: 'a', quantity: 3, selected_variants: null },
    ]);
    await remoteSetQuantity('u@x.fr', 'p1', 0, { name: 'A', unitPrice: 4 });
    expect(cartItemEntity().delete).toHaveBeenCalledWith('a');
  });
});
