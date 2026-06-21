import { useMenuDrawer } from '../menuDrawer';

describe('useMenuDrawer', () => {
  beforeEach(() => {
    useMenuDrawer.setState({ isOpen: false, activeRoute: null });
  });

  it('démarre fermé sans route active', () => {
    expect(useMenuDrawer.getState().isOpen).toBe(false);
    expect(useMenuDrawer.getState().activeRoute).toBeNull();
  });

  it('open() ouvre le drawer', () => {
    useMenuDrawer.getState().open();
    expect(useMenuDrawer.getState().isOpen).toBe(true);
  });

  it('open(route) stocke la route active pour le highlight', () => {
    useMenuDrawer.getState().open('OrdersTab');
    expect(useMenuDrawer.getState().activeRoute).toBe('OrdersTab');
  });

  it('close() ferme le drawer', () => {
    useMenuDrawer.getState().open('HomeTab');
    useMenuDrawer.getState().close();
    expect(useMenuDrawer.getState().isOpen).toBe(false);
  });

  it('toggle() inverse l\'état', () => {
    expect(useMenuDrawer.getState().isOpen).toBe(false);
    useMenuDrawer.getState().toggle();
    expect(useMenuDrawer.getState().isOpen).toBe(true);
    useMenuDrawer.getState().toggle();
    expect(useMenuDrawer.getState().isOpen).toBe(false);
  });
});
