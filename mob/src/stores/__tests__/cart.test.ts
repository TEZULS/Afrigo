import { useCart } from '../cart';

describe('useCart', () => {
  beforeEach(() => {
    useCart.getState().clear();
  });

  it('démarre avec un panier vide en mode guest', () => {
    expect(useCart.getState().lines).toEqual([]);
    expect(useCart.getState().count()).toBe(0);
    expect(useCart.getState().total()).toBe(0);
    expect(useCart.getState().source).toBe('guest');
  });

  it("setSource() met à jour la source", () => {
    useCart.getState().setSource('synced');
    expect(useCart.getState().source).toBe('synced');
  });

  it("clear() repasse la source à 'guest'", () => {
    useCart.getState().setSource('synced');
    useCart.getState().add({ productId: 'p1', name: 'A', unitPrice: 1 });
    useCart.getState().clear();
    expect(useCart.getState().source).toBe('guest');
    expect(useCart.getState().lines).toEqual([]);
  });

  it('add() ajoute une ligne avec quantité 1 par défaut', () => {
    useCart.getState().add({ productId: 'p1', name: 'A', unitPrice: 5 });
    expect(useCart.getState().lines).toHaveLength(1);
    expect(useCart.getState().lines[0]?.quantity).toBe(1);
    expect(useCart.getState().count()).toBe(1);
    expect(useCart.getState().total()).toBe(5);
  });

  it('add() incrémente la quantité quand la même ligne existe', () => {
    useCart.getState().add({ productId: 'p1', name: 'A', unitPrice: 5 });
    useCart.getState().add({ productId: 'p1', name: 'A', unitPrice: 5, quantity: 2 });
    expect(useCart.getState().lines).toHaveLength(1);
    expect(useCart.getState().lines[0]?.quantity).toBe(3);
    expect(useCart.getState().total()).toBe(15);
  });

  it('add() distingue les variantes différentes', () => {
    useCart.getState().add({
      productId: 'p1',
      name: 'A',
      unitPrice: 5,
      variant: { type: 'size', value: 'S' },
    });
    useCart.getState().add({
      productId: 'p1',
      name: 'A',
      unitPrice: 5,
      variant: { type: 'size', value: 'M' },
    });
    expect(useCart.getState().lines).toHaveLength(2);
    expect(useCart.getState().count()).toBe(2);
  });

  it('remove() décrémente puis supprime la ligne', () => {
    useCart.getState().add({ productId: 'p1', name: 'A', unitPrice: 5, quantity: 2 });
    useCart.getState().remove('p1');
    expect(useCart.getState().lines[0]?.quantity).toBe(1);
    useCart.getState().remove('p1');
    expect(useCart.getState().lines).toHaveLength(0);
  });

  it("setQuantity() à 0 supprime la ligne", () => {
    useCart.getState().add({ productId: 'p1', name: 'A', unitPrice: 5, quantity: 3 });
    useCart.getState().setQuantity('p1', 0);
    expect(useCart.getState().lines).toHaveLength(0);
  });

  it("setQuantity() ajuste la quantité", () => {
    useCart.getState().add({ productId: 'p1', name: 'A', unitPrice: 5 });
    useCart.getState().setQuantity('p1', 7);
    expect(useCart.getState().lines[0]?.quantity).toBe(7);
    expect(useCart.getState().total()).toBe(35);
  });

  it("setQuantity() respecte la variante fournie", () => {
    useCart.getState().add({
      productId: 'p1',
      name: 'A',
      unitPrice: 5,
      variant: { type: 'size', value: 'S' },
    });
    useCart.getState().add({
      productId: 'p1',
      name: 'A',
      unitPrice: 5,
      variant: { type: 'size', value: 'M' },
    });
    useCart.getState().setQuantity('p1', 9, 'M');
    const m = useCart.getState().lines.find((l) => l.variant?.value === 'M');
    const s = useCart.getState().lines.find((l) => l.variant?.value === 'S');
    expect(m?.quantity).toBe(9);
    expect(s?.quantity).toBe(1);
  });

  it("replaceLines() remplace tout", () => {
    useCart.getState().add({ productId: 'p1', name: 'A', unitPrice: 5 });
    useCart
      .getState()
      .replaceLines([{ productId: 'p2', name: 'B', unitPrice: 7, quantity: 2 }]);
    expect(useCart.getState().lines).toHaveLength(1);
    expect(useCart.getState().total()).toBe(14);
  });

  it("clear() vide le panier", () => {
    useCart.getState().add({ productId: 'p1', name: 'A', unitPrice: 5, quantity: 4 });
    useCart.getState().clear();
    expect(useCart.getState().lines).toHaveLength(0);
    expect(useCart.getState().count()).toBe(0);
  });

  it('total() somme correctement plusieurs lignes et quantités', () => {
    useCart.getState().add({ productId: 'p1', name: 'A', unitPrice: 4.99 });
    useCart.getState().add({ productId: 'p2', name: 'B', unitPrice: 3.4, quantity: 8 });
    useCart.getState().add({ productId: 'p3', name: 'C', unitPrice: 4.99, quantity: 12 });
    // 4.99 + 3.4*8 + 4.99*12 = 4.99 + 27.2 + 59.88 = 92.07
    expect(useCart.getState().total()).toBeCloseTo(92.07, 2);
    expect(useCart.getState().count()).toBe(1 + 8 + 12);
  });
});
