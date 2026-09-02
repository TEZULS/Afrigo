import { Alert } from 'react-native';
import {
  TOAST_VISIBILITY_TIME,
  __resetToastForTests,
  getToastState,
  subscribeToast,
  toast,
  type ToastState,
} from '../useToast';

describe('useToast', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    __resetToastForTests();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
    __resetToastForTests();
    jest.useRealTimers();
  });

  it('publie la notification puis la retire d’elle-même', () => {
    toast.success('Commande passée', 'Votre commande a bien été enregistrée.');

    expect(getToastState()).toMatchObject({
      type: 'success',
      text1: 'Commande passée',
      text2: 'Votre commande a bien été enregistrée.',
    });

    jest.advanceTimersByTime(TOAST_VISIBILITY_TIME);
    expect(getToastState()).toBeNull();
  });

  it('notifie les abonnés à l’affichage et au retrait', () => {
    const seen: (ToastState | null)[] = [];
    subscribeToast((s) => seen.push(s));

    toast.info('Analyse en cours…');
    jest.advanceTimersByTime(TOAST_VISIBILITY_TIME);

    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ type: 'info', text1: 'Analyse en cours…' });
    expect(seen[1]).toBeNull();
  });

  it('une notification ne survit jamais au-delà de sa durée, même enchaînée', () => {
    toast.info('Info 1');
    jest.advanceTimersByTime(TOAST_VISIBILITY_TIME - 500);
    toast.info('Info 2');

    // Le minuteur est réarmé sur la nouvelle notification, pas cumulé.
    jest.advanceTimersByTime(TOAST_VISIBILITY_TIME - 1);
    expect(getToastState()).toMatchObject({ text1: 'Info 2' });

    jest.advanceTimersByTime(1);
    expect(getToastState()).toBeNull();
  });

  it('hide() retire immédiatement la notification', () => {
    toast.success('Produit identifié');
    toast.hide();
    expect(getToastState()).toBeNull();
  });

  it('hide() est idempotent et ne notifie pas dans le vide', () => {
    const seen: (ToastState | null)[] = [];
    toast.hide();
    subscribeToast((s) => seen.push(s));
    toast.hide();
    expect(seen).toHaveLength(0);
  });

  it('une erreur ouvre une alerte centrée avec un bouton OK', () => {
    toast.error('Aucun produit identifié', 'Réessayez avec une photo plus nette.');

    expect(getToastState()).toBeNull();
    expect(alertSpy).toHaveBeenCalledWith(
      'Aucun produit identifié',
      'Réessayez avec une photo plus nette.',
      [{ text: 'OK', style: 'default' }],
      { cancelable: true },
    );
  });

  it('une erreur referme la notification en cours', () => {
    toast.info('Analyse en cours…');
    toast.error('Recherche par image impossible');
    expect(getToastState()).toBeNull();
  });
});
