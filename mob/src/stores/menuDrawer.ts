import { create } from 'zustand';

export type MenuActiveRoute =
  | 'HomeTab'
  | 'OrdersTab'
  | 'CartTab'
  | 'ProfileTab'
  | 'MenuTab'
  | null;

interface MenuDrawerState {
  isOpen: boolean;
  activeRoute: MenuActiveRoute;
  open: (active?: MenuActiveRoute) => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Drawer latéral du menu (cf. side menu web). Activé en interceptant le press
 * de l'onglet « Menu » dans `ClientTabs`. Le store reste très fin : juste
 * `isOpen` + la route active pour highlighter l'item courant.
 */
export const useMenuDrawer = create<MenuDrawerState>((set, get) => ({
  isOpen: false,
  activeRoute: null,
  open: (active = null) => set({ isOpen: true, activeRoute: active }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen }),
}));
