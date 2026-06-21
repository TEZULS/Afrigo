import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/types';

const H_PAD = 24;
/** Espace réservé sous le formulaire pour le bloc d’actions fixe (bouton + liens). */
const FOOTER_BLOCK_MIN = 210;

/** Extrait un message lisible depuis les erreurs Base44 / fetch. */
function errText(e: unknown): string {
  const x = e as {
    response?: { data?: unknown };
    message?: string;
  };
  const d = x.response?.data;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object') {
    const o = d as Record<string, unknown>;
    if (typeof o.message === 'string') return o.message;
    if (typeof o.error === 'string') return o.error;
    if (typeof o.detail === 'string') return o.detail;
  }
  return x.message ?? 'Une erreur est survenue';
}

function isEmailAlreadyRegistered(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('already exists') ||
    m.includes('email already') ||
    m.includes('user with this email') ||
    m.includes('déjà utilisé') ||
    m.includes('déjà enregistré') ||
    m.includes('existe déjà')
  );
}

/**
 * L'inscription Base44 réussit toujours — c'est l'auto-login juste après
 * qui échoue avec ce message tant que l'utilisateur n'a pas cliqué sur le
 * lien de confirmation de l'email. On veut afficher un succès dans ce cas
 * (compte bien créé), pas une erreur.
 */
function isVerifyEmailRequired(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('verify your email') ||
    m.includes('email before logging') ||
    m.includes('vérifier votre email') ||
    m.includes('email non vérifié') ||
    m.includes('email not verified')
  );
}

type Mode = 'login' | 'register';

export const LoginScreen: React.FC = () => {
  const {
    loginWithEmailPassword,
    registerWithEmailPassword,
    loginWithBase44,
    requestPasswordReset,
  } = useAuth();
  const { colors } = useTheme();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Login'>>();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('login');
  useEffect(() => {
    const initial = route.params?.initialMode;
    if (initial === 'register' || initial === 'login') setMode(initial);
  }, [route.params?.initialMode]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  const fg = colors.foreground;
  const muted = colors.mutedForeground;
  const border = colors.border;

  const validateEmailPwd = (): string | null => {
    const e = email.trim();
    if (!e) return 'Saisissez votre email.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Email invalide.';
    if (!password || password.length < 6) return 'Le mot de passe doit faire au moins 6 caractères.';
    return null;
  };

  const submit = useCallback(async () => {
    const v = validateEmailPwd();
    if (v) {
      Toast.show({ type: 'error', text1: v });
      return;
    }
    if (mode === 'register') {
      if (password !== confirm) {
        Toast.show({ type: 'error', text1: 'Les mots de passe ne correspondent pas.' });
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await loginWithEmailPassword(email, password);
      } else {
        await registerWithEmailPassword({
          email,
          password,
          fullName: fullName.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          city: city.trim() || undefined,
        });
      }
      nav.goBack();
    } catch (e) {
      const msg = errText(e);
      if (mode === 'register' && isVerifyEmailRequired(msg)) {
        // Inscription RÉUSSIE côté serveur. L'auto-login échoue tant que
        // l'email n'est pas vérifié → on affiche un succès et on bascule
        // l'écran en mode connexion avec l'email pré-rempli.
        Alert.alert(
          'Compte créé !',
          'Merci ! Allez vérifier votre email pour activer votre compte, puis connectez-vous.',
          [
            {
              text: 'OK',
              onPress: () => {
                setMode('login');
                setShowForgot(false);
                setPassword('');
                setConfirm('');
              },
            },
          ],
        );
      } else if (mode === 'register' && isEmailAlreadyRegistered(msg)) {
        Alert.alert(
          'Compte déjà existant',
          'Cet email est déjà utilisé. Connectez-vous avec votre mot de passe ou utilisez « Mot de passe oublié » depuis l’écran Connexion.',
          [
            {
              text: 'Me connecter',
              onPress: () => {
                setMode('login');
                setShowForgot(false);
              },
            },
            { text: 'OK', style: 'cancel' },
          ],
        );
      } else if (mode === 'login' && isVerifyEmailRequired(msg)) {
        Alert.alert(
          'Email non vérifié',
          'Allez vérifier votre email pour activer votre compte avant de vous connecter.',
        );
      } else {
        Toast.show({
          type: 'error',
          text1: mode === 'login' ? 'Connexion impossible' : 'Inscription impossible',
          text2: msg,
          visibilityTime: 4500,
        });
      }
    } finally {
      setBusy(false);
    }
  }, [
    mode,
    email,
    password,
    confirm,
    fullName,
    phone,
    address,
    postalCode,
    city,
    loginWithEmailPassword,
    registerWithEmailPassword,
    nav,
  ]);

  const sendReset = useCallback(async () => {
    const e = email.trim();
    if (!e) {
      Toast.show({ type: 'error', text1: 'Indiquez votre email ci-dessus.' });
      return;
    }
    setResetBusy(true);
    try {
      await requestPasswordReset(e);
      Toast.show({
        type: 'success',
        text1: 'Email envoyé',
        text2: 'Suivez le lien reçu pour réinitialiser votre mot de passe.',
      });
      setShowForgot(false);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Envoi impossible', text2: errText(err) });
    } finally {
      setResetBusy(false);
    }
  }, [email, requestPasswordReset]);

  const openBrowserLogin = useCallback(async () => {
    setBusy(true);
    try {
      await loginWithBase44();
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Connexion navigateur', text2: errText(err) });
    } finally {
      setBusy(false);
    }
  }, [loginWithBase44]);

  const topPad = Math.max(insets.top, 8);
  const footerPadBottom = Math.max(insets.bottom, 16);

  return (
    <Screen
      scroll={false}
      paddingHorizontal={0}
      edges={['top', 'left', 'right']}
      bg={colors.background}
      keyboardBehavior="padding"
    >
      <View style={styles.flex}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollInner,
            {
              paddingTop: topPad,
              paddingHorizontal: H_PAD,
              paddingBottom: 24,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator
          bounces
        >
          <View style={[styles.toolbar, { borderBottomColor: border }]}>
            <Pressable onPress={() => nav.goBack()} hitSlop={12} style={styles.toolbarBtn}>
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

          <Text style={[styles.title, { color: fg }]}>
            {mode === 'login' ? 'Connexion' : 'Création de compte'}
          </Text>
          <Text style={[styles.subtitle, { color: muted }]}>
            {mode === 'login'
              ? 'Entrez votre email et votre mot de passe.'
              : 'Remplissez le formulaire, puis confirmez en bas.'}
          </Text>

          <View style={styles.fields}>
            {mode === 'register' ? (
              <Input
                label="Nom complet"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Marie Dupont"
                autoCapitalize="words"
              />
            ) : null}

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="vous@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              placeholder="Au moins 6 caractères"
              secureTextEntry
              textContentType={mode === 'login' ? 'password' : 'newPassword'}
            />
            {mode === 'register' ? (
              <>
                <Input
                  label="Confirmer le mot de passe"
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Répétez le mot de passe"
                  secureTextEntry
                  textContentType="newPassword"
                />
                <Input
                  label="Téléphone"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="06 12 34 56 78"
                  keyboardType="phone-pad"
                />
                <Input
                  label="Adresse"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="12 rue de la République"
                  autoCapitalize="words"
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Input
                    label="Code postal"
                    value={postalCode}
                    onChangeText={setPostalCode}
                    placeholder="75001"
                    keyboardType="numeric"
                    containerStyle={{ flex: 1 }}
                  />
                  <Input
                    label="Ville"
                    value={city}
                    onChangeText={setCity}
                    placeholder="Paris"
                    autoCapitalize="words"
                    containerStyle={{ flex: 1.4 }}
                  />
                </View>
              </>
            ) : null}
          </View>

          {mode === 'login' && !showForgot ? (
            <View style={styles.linksRow}>
              <Pressable onPress={() => setShowForgot(true)}>
                <Text style={[styles.linkMuted, { color: muted }]}>Mot de passe oublié ?</Text>
              </Pressable>
              <Pressable onPress={() => setMode('register')}>
                <Text style={[styles.linkMuted, { color: muted }]}>
                  Créer un compte{' '}
                  <Text style={{ color: fg, fontWeight: '700' }}>→</Text>
                </Text>
              </Pressable>
            </View>
          ) : null}

          {mode === 'register' ? (
            <Pressable onPress={() => setMode('login')} style={{ marginTop: 14 }}>
              <Text style={[styles.linkMuted, { color: muted }]}>
                Déjà un compte ?{' '}
                <Text style={{ color: fg, fontWeight: '700' }}>Se connecter</Text>
              </Text>
            </Pressable>
          ) : null}

          {mode === 'login' && showForgot ? (
            <View style={[styles.forgotBox, { borderColor: border, backgroundColor: colors.muted }]}>
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
        </ScrollView>

        <View
          style={[
            styles.dock,
            {
              borderTopColor: border,
              backgroundColor: colors.background,
              paddingBottom: footerPadBottom,
              paddingHorizontal: H_PAD,
            },
          ]}
          pointerEvents="box-none"
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
          />

          <View style={[styles.sep, { marginTop: 14 }]}>
            <View style={[styles.sepLine, { backgroundColor: border }]} />
            <Text style={[styles.sepTxt, { color: muted }]}>ou</Text>
            <View style={[styles.sepLine, { backgroundColor: border }]} />
          </View>

          <Pressable
            onPress={() => void openBrowserLogin()}
            disabled={busy}
            style={{ marginTop: 12 }}
            hitSlop={8}
          >
            <Text style={[styles.secLink, { color: fg }]}>Continuer avec Google / navigateur</Text>
          </Pressable>

          <Pressable onPress={() => nav.goBack()} disabled={busy} style={{ marginTop: 10 }} hitSlop={8}>
            <Text style={[styles.secLinkMuted, { color: muted }]}>Continuer en invité</Text>
          </Pressable>
        </View>
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

  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 14,
    flexWrap: 'wrap',
    gap: 12,
  },
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
