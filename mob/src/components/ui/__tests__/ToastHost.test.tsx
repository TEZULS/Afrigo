import React from 'react';
import { act } from '@testing-library/react-native';
import { renderWithProviders, screen } from '@/__tests__/test-utils';
import { ToastHost } from '@/components/ui/ToastHost';
import { TOAST_VISIBILITY_TIME, __resetToastForTests, toast } from '@/hooks/useToast';

describe('ToastHost', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetToastForTests();
  });

  afterEach(() => {
    __resetToastForTests();
    jest.useRealTimers();
  });

  it('ne monte rien tant qu’aucune notification n’est demandée', () => {
    renderWithProviders(<ToastHost />);
    expect(screen.queryByTestId('toast-host')).toBeNull();
  });

  it('affiche la notification demandée', () => {
    renderWithProviders(<ToastHost />);

    act(() => {
      toast.success('Modification enregistrée');
    });

    expect(screen.getByTestId('toast-host')).toBeTruthy();
    expect(screen.getByText('Modification enregistrée')).toBeTruthy();
  });

  it('démonte la notification à l’expiration — elle ne peut pas rester collée', () => {
    renderWithProviders(<ToastHost />);

    act(() => {
      toast.success('Modification enregistrée');
    });
    expect(screen.queryByTestId('toast-host')).not.toBeNull();

    act(() => {
      jest.advanceTimersByTime(TOAST_VISIBILITY_TIME);
    });

    // Démonté, et pas seulement rendu transparent : c'est ce qui garantit
    // qu'aucune animation manquée ne peut laisser le bandeau à l'écran.
    expect(screen.queryByTestId('toast-host')).toBeNull();
    expect(screen.queryByText('Modification enregistrée')).toBeNull();
  });

  it('un tap referme la notification immédiatement', () => {
    renderWithProviders(<ToastHost />);

    act(() => {
      toast.info('Analyse en cours…', 'Identification du produit');
    });

    act(() => {
      screen.getByRole('alert').props.onClick?.();
      screen.getByRole('alert').props.onPress?.();
    });

    expect(screen.queryByTestId('toast-host')).toBeNull();
  });

  it('remplace la notification précédente sans en empiler deux', () => {
    renderWithProviders(<ToastHost />);

    act(() => {
      toast.success('Adresse modifiée');
    });
    act(() => {
      toast.success('Nom et prénom modifiés');
    });

    expect(screen.queryByText('Adresse modifiée')).toBeNull();
    expect(screen.getByText('Nom et prénom modifiés')).toBeTruthy();
  });
});
