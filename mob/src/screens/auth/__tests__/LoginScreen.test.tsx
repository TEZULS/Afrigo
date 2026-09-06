import React from 'react';
import { Keyboard, ScrollView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { renderWithProviders, fireEvent, screen, waitFor } from '@/__tests__/test-utils';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false }),
    useRoute: () => ({ name: 'Login', key: 'login', params: { initialMode: 'register' } }),
  };
});

const mockRegister = jest.fn();
const mockVerifyOtp = jest.fn();
const mockResendOtp = jest.fn();

jest.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    isLoadingAuth: false,
    isLoadingPublicSettings: false,
    authError: null,
    appPublicSettings: null,
    loginWithEmailPassword: jest.fn(),
    registerWithEmailPassword: mockRegister,
    verifyEmailOtp: mockVerifyOtp,
    resendEmailOtp: mockResendOtp,
    loginWithApple: jest.fn(),
    loginWithGoogle: jest.fn(),
    loginWithBase44: jest.fn(),
    requestPasswordReset: jest.fn(),
    logout: jest.fn(),
    refresh: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Le composant Apple/Google déclenche des modules natifs inutiles ici.
jest.mock('@/screens/auth/SocialSignInButtons', () => ({
  SocialSignInButtons: () => null,
}));

import { FIELD_SCROLL_MARGIN } from '@/hooks/useKeyboardAwareFields';
import { LoginScreen } from '../LoginScreen';

const wrap = (ui: React.ReactElement) => <NavigationContainer>{ui}</NavigationContainer>;

/** État civil : obligatoire depuis que base44 en a besoin pour commander. */
const fillCivilStatus = () => {
  fireEvent.press(screen.getByLabelText('Mme'));
  fireEvent.changeText(screen.getByPlaceholderText('Marie'), 'Salma');
  fireEvent.changeText(screen.getByPlaceholderText('Dupont'), 'Timo');
};

const fillRegisterForm = (password: string) => {
  fillCivilStatus();
  fireEvent.changeText(screen.getByPlaceholderText('vous@email.com'), 'marnepropre@gmail.com');
  fireEvent.changeText(screen.getByPlaceholderText('Au moins 8 caractères'), password);
  fireEvent.changeText(screen.getByPlaceholderText('Répétez le mot de passe'), password);
};

describe('LoginScreen — inscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegister.mockResolvedValue({ status: 'verification_required' });
  });

  it('refuse un mot de passe de 7 caractères en français, sans appeler le serveur', async () => {
    // Capture 1 : « Kanesam » passait la validation locale (6 car.) puis Base44
    // répondait « Password must be at least 8 characters long ».
    renderWithProviders(wrap(<LoginScreen />));
    await waitFor(() => expect(screen.getByText('Création de compte')).toBeTruthy());

    fillRegisterForm('Kanesam');
    fireEvent.press(screen.getByText('Créer mon compte'));

    await waitFor(() =>
      expect(screen.getByText('Le mot de passe doit contenir au moins 8 caractères.')).toBeTruthy(),
    );
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('signale une confirmation différente en français', async () => {
    renderWithProviders(wrap(<LoginScreen />));
    await waitFor(() => expect(screen.getByText('Création de compte')).toBeTruthy());

    fillCivilStatus();
    fireEvent.changeText(screen.getByPlaceholderText('vous@email.com'), 'marnepropre@gmail.com');
    fireEvent.changeText(screen.getByPlaceholderText('Au moins 8 caractères'), 'Kanesamas');
    fireEvent.changeText(screen.getByPlaceholderText('Répétez le mot de passe'), 'Kanesama');
    fireEvent.press(screen.getByText('Créer mon compte'));

    await waitFor(() =>
      expect(screen.getByText('Les mots de passe ne correspondent pas.')).toBeTruthy(),
    );
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('enchaîne sur la saisie du code au lieu d’afficher « Inscription impossible »', async () => {
    // Capture 2 : le compte était bien créé et le code envoyé par email, mais
    // l'auto-login échouait et l'app annonçait un échec d'inscription.
    renderWithProviders(wrap(<LoginScreen />));
    await waitFor(() => expect(screen.getByText('Création de compte')).toBeTruthy());

    fillRegisterForm('Kanesamas');
    fireEvent.press(screen.getByText('Créer mon compte'));

    await waitFor(() => expect(screen.getByText('Vérifiez votre email')).toBeTruthy());
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'marnepropre@gmail.com', password: 'Kanesamas' }),
    );
    expect(screen.getByText('Activer mon compte')).toBeTruthy();
  });

  it('valide le compte avec le code reçu par email', async () => {
    mockVerifyOtp.mockResolvedValue(undefined);
    renderWithProviders(wrap(<LoginScreen />));
    await waitFor(() => expect(screen.getByText('Création de compte')).toBeTruthy());

    fillRegisterForm('Kanesamas');
    fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(screen.getByTestId('otp-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('otp-input'), '123456');
    fireEvent.press(screen.getByText('Activer mon compte'));

    await waitFor(() =>
      expect(mockVerifyOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'marnepropre@gmail.com', otpCode: '123456' }),
      ),
    );
  });

  it('refuse un code incomplet en français', async () => {
    renderWithProviders(wrap(<LoginScreen />));
    await waitFor(() => expect(screen.getByText('Création de compte')).toBeTruthy());

    fillRegisterForm('Kanesamas');
    fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(screen.getByTestId('otp-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('otp-input'), '123');
    fireEvent.press(screen.getByText('Activer mon compte'));

    await waitFor(() => expect(screen.getByText('Le code doit contenir 6 chiffres.')).toBeTruthy());
    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it('traduit en français une erreur serveur sur le code', async () => {
    mockVerifyOtp.mockRejectedValue(new Error('Invalid or expired OTP code'));
    renderWithProviders(wrap(<LoginScreen />));
    await waitFor(() => expect(screen.getByText('Création de compte')).toBeTruthy());

    fillRegisterForm('Kanesamas');
    fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(screen.getByTestId('otp-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('otp-input'), '999999');
    fireEvent.press(screen.getByText('Activer mon compte'));

    await waitFor(() =>
      expect(screen.getByText(/Code de vérification incorrect ou expiré/)).toBeTruthy(),
    );
  });
});

describe('LoginScreen — clavier et champs du formulaire', () => {
  /*
    Capture 3 : pendant l'inscription, le champ en cours de saisie (Ville, Code
    postal, Adresse) restait masqué par le clavier — impossible de relire ce
    qu'on tapait, ni de voir les suggestions d'adresse affichées juste dessous.
  */
  const scrollTo = jest.fn();
  let keyboardListeners: Record<string, ((e: unknown) => void)[]> = {};

  const emitKeyboard = (event: string, payload: unknown) => {
    for (const cb of keyboardListeners[event] ?? []) cb(payload);
  };

  const layout = (y: number) => ({
    nativeEvent: { layout: { x: 0, y, width: 300, height: 44 } },
  });

  /**
   * `onLayout` ne se déclenche pas hors device : on simule la mesure du champ
   * en remontant jusqu'au premier conteneur qui écoute la mise en page.
   */
  const measureField = (input: ReturnType<typeof screen.getByPlaceholderText>, y: number) => {
    let node = input.parent;
    while (node && typeof node.props?.onLayout !== 'function') node = node.parent;
    if (!node) throw new Error('conteneur onLayout introuvable');
    fireEvent(node, 'layout', layout(y));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRegister.mockResolvedValue({ status: 'verification_required' });
    scrollTo.mockClear();
    keyboardListeners = {};

    jest.spyOn(Keyboard, 'addListener').mockImplementation(((
      event: string,
      cb: (e: unknown) => void,
    ) => {
      (keyboardListeners[event] ??= []).push(cb);
      return {
        remove: () => {
          keyboardListeners[event] = (keyboardListeners[event] ?? []).filter((f) => f !== cb);
        },
      };
    }) as never);

    jest
      .spyOn(ScrollView.prototype, 'scrollTo')
      .mockImplementation(((...args: unknown[]) => scrollTo(...args)) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('remonte le champ Adresse au-dessus du clavier une fois celui-ci ouvert', async () => {
    renderWithProviders(wrap(<LoginScreen />));
    await waitFor(() => expect(screen.getByText('Création de compte')).toBeTruthy());

    fireEvent(screen.getByTestId('auth-fields'), 'layout', layout(300));
    const address = screen.getByPlaceholderText('12 rue de la République');
    measureField(address, 520);

    fireEvent(address, 'focus');
    scrollTo.mockClear();

    // Le défilement utile est celui qui suit l'ouverture réelle du clavier :
    // avant, la zone scrollable n'a pas encore sa hauteur définitive.
    emitKeyboard('keyboardDidShow', { endCoordinates: { height: 336 } });
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());

    const [{ y }] = scrollTo.mock.calls[scrollTo.mock.calls.length - 1] as [{ y: number }];
    expect(y).toBe(300 + 520 - FIELD_SCROLL_MARGIN);
  });

  it('remonte aussi le champ Code postal, ouvert avec le pavé numérique', async () => {
    renderWithProviders(wrap(<LoginScreen />));
    await waitFor(() => expect(screen.getByText('Création de compte')).toBeTruthy());

    fireEvent(screen.getByTestId('auth-fields'), 'layout', layout(300));
    const postalCode = screen.getByPlaceholderText('51000');
    measureField(postalCode, 460);

    fireEvent(postalCode, 'focus');
    scrollTo.mockClear();

    emitKeyboard('keyboardDidShow', { endCoordinates: { height: 260 } });
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());

    const [{ y }] = scrollTo.mock.calls[scrollTo.mock.calls.length - 1] as [{ y: number }];
    expect(y).toBe(300 + 460 - FIELD_SCROLL_MARGIN);
  });

  it('cesse de déplacer le formulaire une fois le clavier refermé', async () => {
    renderWithProviders(wrap(<LoginScreen />));
    await waitFor(() => expect(screen.getByText('Création de compte')).toBeTruthy());

    fireEvent(screen.getByTestId('auth-fields'), 'layout', layout(300));
    const phone = screen.getByPlaceholderText('06 12 34 56 78');
    measureField(phone, 400);

    fireEvent(phone, 'focus');
    emitKeyboard('keyboardDidShow', { endCoordinates: { height: 336 } });
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());

    emitKeyboard('keyboardDidHide', {});
    scrollTo.mockClear();
    emitKeyboard('keyboardDidShow', { endCoordinates: { height: 336 } });

    await waitFor(() => expect(scrollTo).not.toHaveBeenCalled());
  });
});
