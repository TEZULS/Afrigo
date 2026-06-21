/**
 * Garantit la non-régression du bug "panier ×2 à chaque reload" :
 * lorsque le panier local est déjà marqué `synced` (provient du serveur),
 * la fusion ne doit PAS s'exécuter, sinon chaque démarrage doublerait
 * les quantités côté serveur.
 *
 * On teste la fonction réelle en interceptant les appels Base44 via le
 * mock global défini dans `jest.setup.js`.
 */
import { useCart } from '@/stores/cart';
import { syncCartWithServerAfterLogin } from '../cartServerSync';
import { getBase44 } from '@/api/base44Client';

type Spy = jest.Mock;

const cartItemEntity = (): {
  filter: Spy;
  create: Spy;
  update: Spy;
  delete: Spy;
} => {
  const ent = (
    getBase44() as unknown as {
      entities: {
        CartItem: { filter: Spy; create: Spy; update: Spy; delete: Spy };
      };
    }
  ).entities.CartItem;
  return ent;
};

describe('syncCartWithServerAfterLogin', () => {
  beforeEach(() => {
    useCart.getState().clear();
    const ci = cartItemEntity();
    ci.filter.mockClear();
    ci.create.mockClear();
    ci.update.mockClear();
    ci.delete.mockClear();
    // Comportement par défaut : panier serveur vide (filter retourne []).
    ci.filter.mockResolvedValue([]);
    ci.create.mockResolvedValue({ id: 'srv1' });
    ci.update.mockResolvedValue({});
  });

  it('NE fusionne PAS quand le panier local est déjà synced (bug ×2)', async () => {
    useCart.setState({
      lines: [{ productId: 'p1', name: 'Pklo', unitPrice: 4.99, quantity: 56 }],
      source: 'synced',
    });

    await syncCartWithServerAfterLogin('user@x.fr');

    const ci = cartItemEntity();
    // Ni create ni update appelés → pas de re-fusion.
    expect(ci.create).not.toHaveBeenCalled();
    expect(ci.update).not.toHaveBeenCalled();
    // hydrate appelle filter() sur le panier serveur.
    expect(ci.filter).toHaveBeenCalled();
    // L'état est passé en synced.
    expect(useCart.getState().source).toBe('synced');
  });

  it("fusionne quand le panier local est 'guest' et non vide", async () => {
    useCart.setState({
      lines: [{ productId: 'p1', name: 'Pklo', unitPrice: 4.99, quantity: 3 }],
      source: 'guest',
    });

    await syncCartWithServerAfterLogin('user@x.fr');

    const ci = cartItemEntity();
    // Côté serveur vide → create appelé pour créer la ligne.
    expect(ci.create).toHaveBeenCalledTimes(1);
  });

  it("ne fusionne pas quand le panier local guest est vide", async () => {
    useCart.setState({ lines: [], source: 'guest' });

    await syncCartWithServerAfterLogin('user@x.fr');

    const ci = cartItemEntity();
    expect(ci.create).not.toHaveBeenCalled();
    expect(ci.update).not.toHaveBeenCalled();
  });
});
