import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { useAuth, type RegisterProfile } from '@/lib/AuthContext';
import { CIVILITY_OPTIONS, type Civility } from '@/utils/civility';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';
import {
  validateLoginForm,
  validateRegisterForm,
  validateOtpCode,
  validateCivilStatus,
  MIN_REGISTER_PASSWORD_LENGTH,
  OTP_CODE_LENGTH,
} from '@/screens/auth/loginValidation';
import {
  PHONE_PREFIX,
  formatFrenchPhone,
  isCompleteFrenchPhone,
  validatePhone,
  validatePhoneConfirmation,
} from '@/utils/phone';
import { SocialSignInButtons } from '@/screens/auth/SocialSignInButtons';
import { useKeyboardAwareFields } from '@/hooks/useKeyboardAwareFields';
import {
  authErrorMessage,
  isEmailAlreadyRegistered,
  isEmailVerificationRequired,
  isInvalidCredentials,
} from '@/lib/authErrors';
import type { AddressSuggestion } from '@/services/addressAutocomplete';

const H_PAD = 24;

/** Délai avant de pouvoir redemander un code de vérification (secondes). */
const RESEND_COOLDOWN_S = 45;

type Mode = 'login' | 'register';
/** `otp` = compte créé, en attente du code à 6 chiffres envoyé par email. */
type Step = 'form' | 'otp';

export const LoginScreen: React.FC = () => {
  const {
    loginWithEmailPassword,
    registerWithEmailPassword,
    verifyEmailOtp,
    resendEmailOtp,
    loginWithApple,
    loginWithGoogle,
    requestPasswordReset,
  } = useAuth();
  const { colors } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Login'>>();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('form');
  useEffect(() => {
    const initial = route.params?.initialMode;
    if (initial === 'register' || initial === 'login') setMode(initial);
  }, [route.params?.initialMode]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [civility, setCivility] = useState<Civility | ''>('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  /** Téléphone saisi deux fois, +33 déjà en place, chiffres regroupés par deux. */
  const [phone, setPhone] = useState(PHONE_PREFIX);
  const [phoneConfirm, setPhoneConfirm] = useState(PHONE_PREFIX);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneConfirmError, setPhoneConfirmError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  /** Adresse obligatoire à l'inscription, comme tous les autres champs. */
  const [addressError, setAddressError] = useState<string | null>(null);
  const [postalCodeError, setPostalCodeError] = useState<string | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [civilityError, setCivilityError] = useState<string | null>(null);
  const [firstNameError, setFirstNameError] = useState<string | null>(null);
  const [lastNameError, setLastNameError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  /** Profil saisi au formulaire, appliqué une fois l'email vérifié. */
  const registerProfile = useCallback(
    (): RegisterProfile => ({
      civility: civility || undefined,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      phone: isCompleteFrenchPhone(phone) ? formatFrenchPhone(phone) : undefined,
      address: address.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      city: city.trim() || undefined,
    }),
    [civility, firstName, lastName, phone, address, postalCode, city],
  );

  /** Décompte avant de pouvoir redemander un code. */
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  /**
   * Remontée automatique du champ en cours de saisie au-dessus du clavier.
   *
   * Le formulaire d'inscription est long (état civil → adresse) : sans cette
   * mécanique, les derniers champs — et surtout la liste de suggestions
   * d'adresse rendue juste en dessous — restent cachés derrière le clavier.
   * `useKeyboardAwareFields` rejoue le défilement une fois le clavier
   * réellement déployé, moment où la zone scrollable a sa hauteur définitive.
   */
  const scrollRef = useRef<ScrollView>(null);
  const {
    keyboardHeight,
    onContainerLayout: onFieldsLayout,
    onFieldLayout,
    onFieldFocus: focusField,
    onContentSizeChange: onFormContentSizeChange,
  } = useKeyboardAwareFields(scrollRef);

  const fg = colors.foreground;
  const muted = colors.mutedForeground;
  const border = colors.border;

  /** Commune choisie : remplit Ville + Code postal, qui filtrera l'adresse. */
  const applyCitySuggestion = useCallback((s: AddressSuggestion) => {
    if (s.city) setCity(s.city);
    if (s.postalCode) setPostalCode(s.postalCode);
    setCityError(null);
    if (s.postalCode) setPostalCodeError(null);
    Keyboard.dismiss();
  }, []);

  /** Adresse choisie : complète aussi code postal et ville si besoin. */
  const applyAddressSuggestion = useCallback((s: AddressSuggestion) => {
    if (s.street) setAddress(s.street);
    if (s.postalCode) setPostalCode(s.postalCode);
    if (s.city) setCity(s.city);
    setAddressError(null);
    if (s.postalCode) setPostalCodeError(null);
    if (s.city) setCityError(null);
    Keyboard.dismiss();
  }, []);

  /** Passe à l'étape « code de vérification » (compte créé, email à valider). */
  const goToOtpStep = useCallback(() => {
    setStep('otp');
    setOtpCode('');
    setOtpError(null);
    setResendIn(RESEND_COOLDOWN_S);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const backToForm = useCallback(() => {
    setStep('form');
    setOtpCode('');
    setOtpError(null);
  }, []);

  const submit = useCallback(async () => {
    Keyboard.dismiss();

    if (mode === 'register') {
      const v = validateRegisterForm(email, password, confirm);
      const civil = validateCivilStatus(civility, firstName, lastName);
      setEmailError(v.emailError);
      setPasswordError(v.passwordError);
      setConfirmError(v.confirmError);
      setCivilityError(civil.civilityError);
      setFirstNameError(civil.firstNameError);
      setLastNameError(civil.lastNameError);
      const phoneErr = validatePhone(phone);
      const phoneConfirmErr = phoneErr ? null : validatePhoneConfirmation(phone, phoneConfirm);
      setPhoneError(phoneErr);
      setPhoneConfirmError(phoneConfirmErr);
      const addressErr = address.trim() ? null : 'Saisissez votre adresse.';
      const postalCodeErr = /^[0-9]{5}$/.test(postalCode.trim())
        ? null
        : postalCode.trim()
          ? 'Code postal à 5 chiffres.'
          : 'Saisissez votre code postal.';
      const cityErr = city.trim() ? null : 'Saisissez votre ville.';
      setAddressError(addressErr);
      setPostalCodeError(postalCodeErr);
      setCityError(cityErr);
      if (
        addressErr ||
        postalCodeErr ||
        cityErr ||
        phoneErr ||
        phoneConfirmErr ||
        v.emailError ||
        v.passwordError ||
        v.confirmError ||
        civil.civilityError ||
        civil.firstNameError ||
        civil.lastNameError
      ) {
        return;
      }
    } else {
      const v = validateLoginForm(email, password);
      setEmailError(v.emailError);
      setPasswordError(v.passwordError);
      setConfirmError(null);
      if (v.emailError || v.passwordError) return;
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await loginWithEmailPassword(email, password);
        nav.goBack();
      } else {
        const outcome = await registerWithEmailPassword({
          email,
          password,
          ...registerProfile(),
        });
        if (outcome.status === 'verification_required') {
          // Le compte est créé : Base44 vient d'envoyer le code par email.
          goToOtpStep();
        } else {
          nav.goBack();
        }
      }
    } catch (e) {
      if (mode === 'register' && isEmailAlreadyRegistered(e)) {
        Alert.alert(
          'Compte déjà existant',
          'Cet email est déjà utilisé. Connectez-vous, ou saisissez le code de vérification si vous venez de créer ce compte.',
          [
            {
              text: 'Me connecter',
              onPress: () => {
                setMode('login');
                setShowForgot(false);
              },
            },
            {
              text: 'Saisir le code',
              onPress: () => {
                goToOtpStep();
                void resendEmailOtp(email).catch(() => {});
              },
            },
            { text: 'Annuler', style: 'cancel' },
          ],
        );
      } else if (mode === 'login' && isEmailVerificationRequired(e)) {
        Alert.alert(
          'Email non vérifié',
          `Saisissez le code à ${OTP_CODE_LENGTH} chiffres envoyé à ${email.trim()} pour activer votre compte.`,
          [
            {
              text: 'Saisir le code',
              onPress: () => {
                goToOtpStep();
                void resendEmailOtp(email).catch(() => {});
              },
            },
            { text: 'Annuler', style: 'cancel' },
          ],
        );
      } else if (mode === 'login' && isInvalidCredentials(e)) {
        // Base44 répond « Invalid email or password » aussi bien pour un
        // mauvais mot de passe que pour un compte jamais vérifié : on propose
        // les deux issues plutôt que de laisser l'utilisateur bloqué.
        Alert.alert(
          'Connexion impossible',
          `${authErrorMessage(e)}\n\nSi vous venez de créer ce compte, il doit d’abord être activé avec le code envoyé par email.`,
          [
            {
              text: 'Activer mon compte',
              onPress: () => {
                goToOtpStep();
                void resendEmailOtp(email).catch(() => {});
              },
            },
            { text: 'Réessayer', style: 'cancel' },
          ],
        );
      } else {
        /*
          IMPORTANT : l'écran Connexion est présenté en `modal` natif (voir
          RootNavigator). Un Toast (monté à la racine React) s'afficherait
          DERRIÈRE la modale → invisible, et le bouton paraît « inactif »
          (bug 2.1a signalé par App Review). On utilise donc `Alert` natif,
          qui s'affiche toujours au-dessus de la modale.
        */
        Alert.alert(
          mode === 'login' ? 'Connexion impossible' : 'Inscription impossible',
          authErrorMessage(e),
        );
      }
    } finally {
      setBusy(false);
    }
  }, [
    mode,
    email,
    password,
    confirm,
    civility,
    firstName,
    lastName,
    phone,
    phoneConfirm,
    address,
    postalCode,
    city,
    registerProfile,
    loginWithEmailPassword,
    registerWithEmailPassword,
    resendEmailOtp,
    goToOtpStep,
    nav,
  ]);

  const submitOtp = useCallback(async () => {
    Keyboard.dismiss();
    const err = validateOtpCode(otpCode);
    setOtpError(err);
    if (err) return;

    setBusy(true);
    try {
      await verifyEmailOtp({
        email,
        otpCode,
        password,
        profile: registerProfile(),
      });
      nav.goBack();
    } catch (e) {
      setOtpError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [otpCode, email, password, registerProfile, verifyEmailOtp, nav]);

  const resendOtp = useCallback(async () => {
    if (resendIn > 0) return;
    setBusy(true);
    try {
      await resendEmailOtp(email);
      setResendIn(RESEND_COOLDOWN_S);
      Alert.alert('Code renvoyé', `Un nouveau code vient d’être envoyé à ${email.trim()}.`);
    } catch (e) {
      Alert.alert('Envoi impossible', authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [email, resendIn, resendEmailOtp]);

  const sendReset = useCallback(async () => {
    const e = email.trim();
    if (!e) {
      setEmailError('Indiquez votre email ci-dessus.');
      return;
    }
    setResetBusy(true);
    try {
      await requestPasswordReset(e);
      Alert.alert(
        'Email envoyé',
        'Suivez le lien reçu pour réinitialiser votre mot de passe.',
      );
      setShowForgot(false);
    } catch (err) {
      Alert.alert('Envoi impossible', authErrorMessage(err));
    } finally {
      setResetBusy(false);
    }
  }, [email, requestPasswordReset]);

  const runSocialLogin = useCallback(
    async (provider: 'apple' | 'google') => {
      setBusy(true);
      try {
        if (provider === 'apple') {
          await loginWithApple();
        } else {
          await loginWithGoogle();
        }
        nav.goBack();
      } catch (err) {
        Alert.alert(
          provider === 'apple' ? 'Connexion Apple' : 'Connexion Google',
          authErrorMessage(err),
        );
      } finally {
        setBusy(false);
      }
    },
    [loginWithApple, loginWithGoogle, nav],
  );

  const topPad = Math.max(insets.top, 8);
  const footerPadBottom = Math.max(insets.bottom, 16);
  const isOtpStep = step === 'otp';

  return (
    <Screen
      scroll={false}
      paddingHorizontal={0}
      edges={['top', 'left', 'right']}
      bg={colors.background}
      /*
        Pas de KeyboardAvoidingView ici : sur iOS c'est
        `automaticallyAdjustKeyboardInsets` du ScrollView qui gère l'espace
        clavier (sinon les deux mécanismes se cumulent et le formulaire
        « saute »), sur Android c'est `adjustResize`.
      */
      keyboardBehavior="none"
    >
      <View style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollInner,
            {
              paddingTop: topPad,
              paddingHorizontal: H_PAD,
              /*
                Réserve explicite pour le clavier, sur iOS comme sur Android :
                en affichage bord à bord (Android 15+, API 35/36), `adjustResize`
                ne rétrécit plus la fenêtre et le clavier recouvrait la case
                Ville. Sans cette marge,
                `scrollTo` est borné par la hauteur du contenu et ne peut pas
                remonter les derniers champs au-dessus du clavier.
                On préfère cette réserve à `automaticallyAdjustKeyboardInsets`,
                dont l'inset arrive après le `onFocus` — donc trop tard.
              */
              paddingBottom: 8 + keyboardHeight,
            },
          ]}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
          bounces
          onContentSizeChange={onFormContentSizeChange}
        >
          <View style={[styles.toolbar, { borderBottomColor: border }]}>
            <Pressable
              onPress={() => (isOtpStep ? backToForm() : nav.goBack())}
              hitSlop={12}
              style={styles.toolbarBtn}
            >
              <Text style={[styles.toolbarLink, { color: fg }]}>← Retour</Text>
            </Pressable>
            <Pressable
              onPress={() => nav.navigate('ClientTabs', { screen: 'HomeTab' })}
              hitSlop={12}
              style={styles.toolbarBtn}
            >
              <Text style={[styles.toolbarMuted, { color: muted }]}>Accueil</Text>
            </Pressable>
          </View>

          {isOtpStep ? (
            <>
              <Text style={[styles.title, { color: fg }]}>Vérifiez votre email</Text>
              <Text style={[styles.subtitle, { color: muted }]}>
                Votre compte est créé. Saisissez le code à {OTP_CODE_LENGTH} chiffres envoyé à{' '}
                <Text style={{ color: fg, fontWeight: '700' }}>{email.trim()}</Text> pour
                l’activer.
              </Text>

              <View style={styles.fields}>
                <Input
                  label="Code de vérification"
                  value={otpCode}
                  onChangeText={(v) => {
                    // Seuls les chiffres : les apps mail collent parfois des espaces.
                    setOtpCode(v.replace(/[^0-9]/g, '').slice(0, OTP_CODE_LENGTH));
                    if (otpError) setOtpError(null);
                  }}
                  placeholder="123456"
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={OTP_CODE_LENGTH}
                  error={otpError ?? undefined}
                  returnKeyType="done"
                  onSubmitEditing={() => void submitOtp()}
                  style={styles.otpInput}
                  testID="otp-input"
                />
              </View>

              <Pressable
                onPress={() => void resendOtp()}
                disabled={busy || resendIn > 0}
                hitSlop={8}
                style={{ marginTop: 4 }}
              >
                <Text style={[styles.linkMuted, { color: resendIn > 0 ? muted : fg }]}>
                  {resendIn > 0
                    ? `Renvoyer le code dans ${resendIn} s`
                    : 'Je n’ai rien reçu — renvoyer le code'}
                </Text>
              </Pressable>

              <Pressable onPress={backToForm} style={{ marginTop: 14 }} hitSlop={8}>
                <Text style={[styles.linkMuted, { color: muted }]}>
                  Modifier mes informations
                </Text>
              </Pressable>

              <Text style={[styles.otpHint, { color: muted }]}>
                Pensez à vérifier vos courriers indésirables si l’email tarde à arriver.
              </Text>

              <View
                style={[
                  styles.dock,
                  {
                    borderTopColor: border,
                    backgroundColor: colors.background,
                    paddingBottom: footerPadBottom,
                    marginHorizontal: -H_PAD,
                    paddingHorizontal: H_PAD,
                  },
                ]}
              >
                <Button
                  title="Activer mon compte"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={busy}
                  disabled={busy}
                  onPress={() => void submitOtp()}
                  style={styles.primaryBtn}
                />
                <Pressable
                  onPress={() => nav.goBack()}
                  disabled={busy}
                  style={{ marginTop: 14 }}
                  hitSlop={8}
                >
                  <Text style={[styles.secLinkMuted, { color: muted }]}>Continuer en invité</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: fg }]}>
                {mode === 'login' ? 'Connexion' : 'Création de compte'}
              </Text>
              <Text style={[styles.subtitle, { color: muted }]}>
                {mode === 'login'
                  ? 'Entrez votre email et votre mot de passe.'
                  : 'Remplissez le formulaire, puis confirmez en bas.'}
              </Text>

              <View style={styles.fields} onLayout={onFieldsLayout} testID="auth-fields">
                {mode === 'register' ? (
                  <>
                    {/*
                      État civil : base44 attend `civility` (M. / Mme / Autre),
                      `first_name` et `last_name` — le web refuse la commande
                      tant que ces champs sont vides. On les demande donc dès
                      l'inscription plutôt qu'après coup dans « Mon profil ».
                    */}
                    <View onLayout={onFieldLayout('civility')} style={styles.civilityBlock}>
                      <Text style={[styles.civilityLabel, { color: fg }]}>État civil</Text>
                      <View
                        style={styles.civilityRow}
                        accessibilityRole="radiogroup"
                        accessibilityLabel="État civil"
                      >
                        {CIVILITY_OPTIONS.map((option) => {
                          const selected = civility === option;
                          return (
                            <Pressable
                              key={option}
                              accessibilityRole="radio"
                              accessibilityState={{ selected }}
                              accessibilityLabel={option}
                              onPress={() => {
                                setCivility(option);
                                if (civilityError) setCivilityError(null);
                              }}
                              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                              style={[
                                styles.civilityChip,
                                {
                                  borderColor: selected ? palette.brand.orange : border,
                                  backgroundColor: selected ? palette.orange[50] : 'transparent',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.civilityChipText,
                                  { color: selected ? palette.brand.orange : fg },
                                ]}
                              >
                                {option}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      {civilityError ? (
                        <Text style={[styles.civilityError, { color: palette.rose[500] }]}>
                          {civilityError}
                        </Text>
                      ) : null}
                    </View>
                    <Input
                      label="Prénom"
                      value={firstName}
                      onChangeText={(v) => {
                        setFirstName(v);
                        if (firstNameError) setFirstNameError(null);
                      }}
                      placeholder="Marie"
                      autoCapitalize="words"
                      error={firstNameError ?? undefined}
                      onContainerLayout={onFieldLayout('firstName')}
                      onFocus={focusField('firstName')}
                    />
                    <Input
                      label="Nom"
                      value={lastName}
                      onChangeText={(v) => {
                        setLastName(v);
                        if (lastNameError) setLastNameError(null);
                      }}
                      placeholder="Dupont"
                      autoCapitalize="words"
                      error={lastNameError ?? undefined}
                      onContainerLayout={onFieldLayout('lastName')}
                      onFocus={focusField('lastName')}
                    />
                  </>
                ) : null}

                <Input
                  label="Email"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (emailError) setEmailError(null);
                  }}
                  placeholder="vous@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={emailError ?? undefined}
                  returnKeyType="next"
                  onContainerLayout={onFieldLayout('email')}
                  onFocus={focusField('email')}
                />
                <Input
                  label="Mot de passe"
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (passwordError) setPasswordError(null);
                  }}
                  placeholder={
                    mode === 'register'
                      ? `Au moins ${MIN_REGISTER_PASSWORD_LENGTH} caractères`
                      : 'Votre mot de passe'
                  }
                  secureTextEntry
                  textContentType={mode === 'login' ? 'password' : 'newPassword'}
                  error={passwordError ?? undefined}
                  returnKeyType={mode === 'login' ? 'done' : 'next'}
                  onSubmitEditing={mode === 'login' ? () => void submit() : undefined}
                  onContainerLayout={onFieldLayout('password')}
                  onFocus={focusField('password')}
                />
                {mode === 'register' ? (
                  <>
                    <Input
                      label="Confirmer le mot de passe"
                      value={confirm}
                      onChangeText={(v) => {
                        setConfirm(v);
                        if (confirmError) setConfirmError(null);
                      }}
                      placeholder="Répétez le mot de passe"
                      secureTextEntry
                      textContentType="newPassword"
                      error={confirmError ?? undefined}
                      onContainerLayout={onFieldLayout('confirm')}
                      onFocus={focusField('confirm')}
                    />
                    <Input
                      label="Téléphone"
                      value={phone}
                      onChangeText={(v) => {
                        setPhone(formatFrenchPhone(v));
                        if (phoneError) setPhoneError(null);
                      }}
                      placeholder="+33 6 12 34 56 78"
                      keyboardType="phone-pad"
                      textContentType="telephoneNumber"
                      error={phoneError ?? undefined}
                      testID="register-phone"
                      onContainerLayout={onFieldLayout('phone')}
                      onFocus={focusField('phone')}
                    />
                    <Input
                      label="Confirmer le téléphone"
                      value={phoneConfirm}
                      onChangeText={(v) => {
                        setPhoneConfirm(formatFrenchPhone(v));
                        if (phoneConfirmError) setPhoneConfirmError(null);
                      }}
                      placeholder="+33 6 12 34 56 78"
                      keyboardType="phone-pad"
                      error={phoneConfirmError ?? undefined}
                      testID="register-phone-confirm"
                      onContainerLayout={onFieldLayout('phoneConfirm')}
                      onFocus={focusField('phoneConfirm')}
                    />
                    {/*
                      Adresse, puis code postal, puis ville (ordre demandé le
                      2026-09-28). Choisir une adresse suggérée remplit aussi le
                      code postal et la ville ; un code postal déjà saisi
                      restreint les suggestions à la commune.
                    */}
                    <AddressAutocomplete
                      value={address}
                      onChangeText={(v) => {
                        setAddress(v);
                        if (addressError) setAddressError(null);
                      }}
                      error={addressError ?? undefined}
                      onSelectSuggestion={applyAddressSuggestion}
                      postalCode={postalCode}
                      onContainerLayout={onFieldLayout('address')}
                      onFocus={focusField('address')}
                    />
                    <Input
                      label="Code postal"
                      value={postalCode}
                      onChangeText={(v) => {
                        setPostalCode(v);
                        if (postalCodeError) setPostalCodeError(null);
                      }}
                      error={postalCodeError ?? undefined}
                      maxLength={5}
                      placeholder="51000"
                      keyboardType="numeric"
                      onContainerLayout={onFieldLayout('postalCode')}
                      onFocus={focusField('postalCode')}
                    />
                    <AddressAutocomplete
                      kind="city"
                      value={city}
                      onChangeText={(v) => {
                        setCity(v);
                        if (cityError) setCityError(null);
                      }}
                      error={cityError ?? undefined}
                      onSelectSuggestion={applyCitySuggestion}
                      onContainerLayout={onFieldLayout('city')}
                      onFocus={focusField('city')}
                    />
                  </>
                ) : null}
              </View>

              {mode === 'login' && !showForgot ? (
                <View style={[styles.linksRow, styles.linksBlock]} testID="auth-links">
                  <Pressable onPress={() => setShowForgot(true)}>
                    <Text style={[styles.linkMuted, { color: muted }]}>Mot de passe oublié ?</Text>
                  </Pressable>
                  <Pressable onPress={() => setMode('register')}>
                    <Text style={[styles.linkMuted, { color: muted }]}>
                      Créer un compte <Text style={{ color: fg, fontWeight: '700' }}>→</Text>
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {mode === 'register' ? (
                <Pressable
                  onPress={() => setMode('login')}
                  style={styles.linksBlock}
                  testID="auth-link-login"
                >
                  <Text style={[styles.linkMuted, { color: muted }]}>
                    Déjà un compte ?{' '}
                    <Text style={{ color: fg, fontWeight: '700' }}>Se connecter</Text>
                  </Text>
                </Pressable>
              ) : null}

              {mode === 'login' && showForgot ? (
                <View
                  style={[styles.forgotBox, { borderColor: border, backgroundColor: colors.muted }]}
                >
                  <Text style={[styles.forgotHint, { color: muted }]}>
                    Réinitialisation du mot de passe — nous envoyons un lien sur votre email.
                  </Text>
                  <Button
                    title={resetBusy ? 'Envoi…' : 'Envoyer le lien'}
                    variant="outline"
                    size="sm"
                    fullWidth
                    loading={resetBusy}
                    disabled={resetBusy}
                    onPress={() => void sendReset()}
                  />
                  <Pressable onPress={() => setShowForgot(false)}>
                    <Text style={[styles.cancelForgot, { color: muted }]}>Fermer</Text>
                  </Pressable>
                </View>
              ) : null}

              {/*
                Le bloc d'actions est dans le ScrollView (pas en dehors) pour que
                `keyboardShouldPersistTaps="always"` s'applique aussi au bouton
                « Se connecter » sur iPad — sinon le 1er tap ferme le clavier sans
                déclencher onPress (bug signalé par App Review).
              */}
              <View
                style={[
                  styles.dock,
                  {
                    borderTopColor: border,
                    backgroundColor: colors.background,
                    paddingBottom: footerPadBottom,
                    marginHorizontal: -H_PAD,
                    paddingHorizontal: H_PAD,
                  },
                ]}
              >
                <Button
                  title={mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={busy}
                  disabled={busy}
                  onPress={() => void submit()}
                  style={styles.primaryBtn}
                  accessibilityHint={
                    mode === 'login'
                      ? 'Connexion avec email et mot de passe saisis ci-dessus'
                      : undefined
                  }
                />

                <View style={[styles.sep, { marginTop: 14 }]}>
                  <View style={[styles.sepLine, { backgroundColor: border }]} />
                  <Text style={[styles.sepTxt, { color: muted }]}>ou</Text>
                  <View style={[styles.sepLine, { backgroundColor: border }]} />
                </View>

                <SocialSignInButtons
                  busy={busy}
                  onApplePress={() => void runSocialLogin('apple')}
                  onGooglePress={() => void runSocialLogin('google')}
                />

                <Pressable
                  onPress={() => nav.goBack()}
                  disabled={busy}
                  style={{ marginTop: 14 }}
                  hitSlop={8}
                >
                  <Text style={[styles.secLinkMuted, { color: muted }]}>Continuer en invité</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flex: 1,
  },
  scrollInner: {
    flexGrow: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -2,
  },
  toolbarBtn: { paddingVertical: 4 },
  toolbarLink: { fontSize: 16, fontWeight: '600' },
  toolbarMuted: { fontSize: 15, fontWeight: '500' },

  title: {
    marginTop: 22,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  },
  fields: { marginTop: 22 },
  /** Bloc « État civil » : trois pastilles M. / Mme / Autre. */
  civilityBlock: { marginBottom: 14 },
  civilityLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  civilityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  civilityChip: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  civilityChipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  civilityError: {
    fontSize: 12,
    marginTop: 6,
  },

  otpInput: { fontSize: 22, letterSpacing: 6, fontWeight: '700' },
  otpHint: { fontSize: 13, lineHeight: 19, marginTop: 18 },

  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  /**
   * « Mot de passe oublié ? / Créer un compte » et « Déjà un compte ? » :
   * remontés près des champs et décollés du bloc du bouton, dont le trait et
   * l'ombre passaient sur le texte.
   */
  linksBlock: { marginTop: 8, marginBottom: 22 },
  linkMuted: { fontSize: 14, fontWeight: '500', flexShrink: 1 },

  forgotBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  forgotHint: { fontSize: 13, lineHeight: 19 },
  cancelForgot: { fontSize: 14, textAlign: 'center', marginTop: 4 },

  dock: {
    /**
     * Avant : `position: 'absolute'` empêchait le KeyboardAvoidingView du
     * `Screen` parent de pousser le dock au-dessus du clavier — résultat,
     * le clavier masquait l'input « Mot de passe ». Maintenant le dock
     * est un flex item normal en bas du conteneur, qui suit la
     * compression du layout quand le clavier s'ouvre.
     */
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  primaryBtn: { borderRadius: 10, minHeight: 52 },

  sep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sepLine: { flex: 1, height: StyleSheet.hairlineWidth },
  sepTxt: { fontSize: 12, fontWeight: '600' },

  secLink: { fontSize: 14, fontWeight: '700', textAlign: 'center', paddingVertical: 6 },
  secLinkMuted: { fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 4 },
});
