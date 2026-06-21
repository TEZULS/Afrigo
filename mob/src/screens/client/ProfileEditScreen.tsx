import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  User,
  Mail,
  Phone,
  MapPin,
  Save,
  Lock,
  Trash2,
  ShieldCheck,
} from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/hooks/useToast';
import { getBase44 } from '@/api/base44Client';
import { invokeFunction } from '@/api/entities';
import type { RootStackParamList } from '@/navigation/types';

type Civility = '' | 'M.' | 'Mme' | 'Mlle';

interface ProfileFormState {
  civility: Civility;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  postal_code: string;
  city: string;
}

function pickInitial(user: Record<string, unknown> | null): ProfileFormState {
  const u = user ?? {};
  const fullName = (u.full_name as string | undefined) ?? '';
  const [fn, ...rest] = fullName.split(' ');
  return {
    civility: ((u.civility as Civility) ?? '') as Civility,
    first_name: (u.first_name as string | undefined) ?? fn ?? '',
    last_name: (u.last_name as string | undefined) ?? rest.join(' '),
    phone: (u.phone as string | undefined) ?? '',
    address: (u.address as string | undefined) ?? '',
    postal_code: (u.postal_code as string | undefined) ?? '',
    city: (u.city as string | undefined) ?? '',
  };
}

export const ProfileEditScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const { user, refresh, logout } = useAuth();
  const toast = useToast();

  const initial = useMemo(() => pickInitial(user as Record<string, unknown> | null), [user]);
  const [form, setForm] = useState<ProfileFormState>(initial);
  const [saving, setSaving] = useState(false);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);

  const [delBusy, setDelBusy] = useState(false);

  const update = useCallback(
    (key: keyof ProfileFormState, value: string) => {
      setForm((p) => ({ ...p, [key]: value }));
    },
    [],
  );

  const validate = (): string | null => {
    if (!form.first_name.trim()) return 'Le prénom est obligatoire.';
    if (!form.last_name.trim()) return 'Le nom est obligatoire.';
    if (form.phone && !/^\+?[\d\s().-]{6,}$/.test(form.phone.trim())) {
      return 'Numéro de téléphone invalide.';
    }
    if (form.postal_code && !/^[A-Za-z0-9 -]{2,10}$/.test(form.postal_code.trim())) {
      return 'Code postal invalide.';
    }
    return null;
  };

  const onSave = useCallback(async () => {
    const v = validate();
    if (v) {
      toast.error('Champ invalide', v);
      return;
    }
    setSaving(true);
    try {
      const fullName = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();
      await getBase44().auth.updateMe({
        civility: form.civility || undefined,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        full_name: fullName,
        phone: form.phone.trim(),
        address: form.address.trim(),
        postal_code: form.postal_code.trim(),
        city: form.city.trim(),
      } as Record<string, unknown>);
      await refresh();
      toast.success('Profil mis à jour');
      nav.goBack();
    } catch (e) {
      toast.error('Mise à jour impossible', (e as Error).message);
    } finally {
      setSaving(false);
    }
  }, [form, nav, refresh, toast]);

  const onChangePassword = useCallback(async () => {
    if (!newPwd || newPwd.length < 6) {
      toast.error('Mot de passe', 'Au moins 6 caractères.');
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error('Mot de passe', 'La confirmation ne correspond pas.');
      return;
    }
    setPwdBusy(true);
    try {
      const res = (await invokeFunction<{ data?: { success?: boolean; error?: string } }>(
        'handleCustomAuth',
        {
          action: 'change_password',
          currentPassword: currentPwd || undefined,
          newPassword: newPwd,
        },
      )) as { data?: { success?: boolean; error?: string } } | undefined;
      const ok = res?.data?.success ?? true;
      if (!ok) throw new Error(res?.data?.error ?? 'Erreur inconnue');
      toast.success('Mot de passe modifié');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (e) {
      toast.error('Changement impossible', (e as Error).message);
    } finally {
      setPwdBusy(false);
    }
  }, [currentPwd, newPwd, confirmPwd, toast]);

  const onDeleteAccount = useCallback(() => {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Toutes vos données seront supprimées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDelBusy(true);
            try {
              await invokeFunction('handleCustomAuth', { action: 'delete_account' });
              await logout();
              nav.navigate('ClientTabs', { screen: 'HomeTab' });
            } catch (e) {
              toast.error('Suppression impossible', (e as Error).message);
            } finally {
              setDelBusy(false);
            }
          },
        },
      ],
    );
  }, [logout, nav, toast]);

  if (!user) {
    return (
      <Screen>
        <Header onBack={nav.goBack} title="Modifier le profil" />
        <View style={{ padding: 16 }}>
          <Text style={{ color: colors.foreground }}>Connectez-vous pour modifier votre profil.</Text>
          <Button
            title="Se connecter"
            variant="primary"
            fullWidth
            onPress={() => nav.navigate('Login')}
            style={{ marginTop: 16 }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardBehavior="padding">
      <Header onBack={nav.goBack} title="Modifier le profil" />

      <Text style={[styles.section, { color: colors.foreground }]}>Identité</Text>
      <Card padding={14}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Civilité</Text>
        <View style={styles.civRow}>
          {(['M.', 'Mme', 'Mlle'] as const).map((c) => {
            const selected = form.civility === c;
            return (
              <Pressable
                key={c}
                onPress={() => update('civility', c)}
                style={[
                  styles.civChip,
                  {
                    borderColor: selected ? colors.brandOrange : colors.border,
                    backgroundColor: selected ? colors.muted : 'transparent',
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected ? colors.foreground : colors.mutedForeground,
                    fontWeight: '700',
                  }}
                >
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Input
          label="Prénom"
          value={form.first_name}
          onChangeText={(v) => update('first_name', v)}
          placeholder="Marie"
          autoCapitalize="words"
          leftIcon={<User size={16} color={colors.mutedForeground} />}
        />
        <Input
          label="Nom"
          value={form.last_name}
          onChangeText={(v) => update('last_name', v)}
          placeholder="Dupont"
          autoCapitalize="words"
        />
        <Input
          label="Email"
          value={user.email}
          editable={false}
          leftIcon={<Mail size={16} color={colors.mutedForeground} />}
        />
        <Input
          label="Téléphone"
          value={form.phone}
          onChangeText={(v) => update('phone', v)}
          placeholder="06 12 34 56 78"
          keyboardType="phone-pad"
          leftIcon={<Phone size={16} color={colors.mutedForeground} />}
        />
      </Card>

      <Text style={[styles.section, { color: colors.foreground }]}>Adresse de livraison</Text>
      <Card padding={14}>
        <Input
          label="Adresse"
          value={form.address}
          onChangeText={(v) => update('address', v)}
          placeholder="12 rue de la République"
          leftIcon={<MapPin size={16} color={colors.mutedForeground} />}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Input
            label="Code postal"
            value={form.postal_code}
            onChangeText={(v) => update('postal_code', v)}
            keyboardType="numeric"
            containerStyle={{ flex: 1 }}
          />
          <Input
            label="Ville"
            value={form.city}
            onChangeText={(v) => update('city', v)}
            containerStyle={{ flex: 1.4 }}
          />
        </View>
      </Card>

      <Button
        title="Enregistrer"
        variant="brand"
        size="lg"
        fullWidth
        loading={saving}
        leftIcon={<Save size={16} color="#FFF" />}
        onPress={onSave}
        style={{ marginTop: 16 }}
      />

      <Text style={[styles.section, { color: colors.foreground }]}>Sécurité</Text>
      <Card padding={14}>
        <Input
          label="Mot de passe actuel"
          value={currentPwd}
          onChangeText={setCurrentPwd}
          secureTextEntry
          textContentType="password"
          leftIcon={<Lock size={16} color={colors.mutedForeground} />}
        />
        <Input
          label="Nouveau mot de passe"
          value={newPwd}
          onChangeText={setNewPwd}
          secureTextEntry
          textContentType="newPassword"
        />
        <Input
          label="Confirmer le nouveau mot de passe"
          value={confirmPwd}
          onChangeText={setConfirmPwd}
          secureTextEntry
          textContentType="newPassword"
        />
        <Button
          title="Changer le mot de passe"
          variant="outline"
          fullWidth
          loading={pwdBusy}
          disabled={!newPwd || !confirmPwd}
          leftIcon={<ShieldCheck size={16} color={colors.foreground} />}
          onPress={onChangePassword}
        />
      </Card>

      <Text style={[styles.section, { color: colors.foreground }]}>Zone dangereuse</Text>
      <Card padding={14} style={{ borderColor: colors.destructive }}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 20 }}>
          La suppression de votre compte est définitive et entraîne la perte de tout votre historique
          (commandes, points de fidélité, portefeuille).
        </Text>
        <Button
          title="Supprimer mon compte"
          variant="destructive"
          fullWidth
          loading={delBusy}
          leftIcon={<Trash2 size={16} color="#FFF" />}
          onPress={onDeleteAccount}
          style={{ marginTop: 12 }}
        />
      </Card>
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 8, fontSize: 14, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  civRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  civChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
});
