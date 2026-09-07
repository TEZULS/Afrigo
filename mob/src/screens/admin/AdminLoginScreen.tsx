import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ShieldCheck } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { invokeFunction } from '@/api/entities';
import { setBase44Token } from '@/api/base44Client';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/theme/ThemeProvider';
import type { RootStackParamList } from '@/navigation/types';
import { authErrorMessage } from '@/lib/authErrors';

interface CustomAuthResponse {
  access_token: string;
  user?: { role?: string };
}

export const AdminLoginScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: async () => {
      const r = await invokeFunction<CustomAuthResponse>('handleCustomAuth', {
        action: 'admin_login',
        email,
        password,
      });
      if (!r?.access_token) throw new Error('Identifiants invalides');
      await setBase44Token(r.access_token);
      return r;
    },
    onSuccess: () => {
      toast.success('Bienvenue');
      nav.replace('AdminDrawer', { screen: 'AdminDashboard' });
    },
    onError: (e: Error) => toast.error('Connexion impossible', authErrorMessage(e)),
  });

  return (
    <Screen>
      <Header onBack={nav.goBack} title="Espace administrateur" />
      <View style={styles.body}>
        <ShieldCheck size={48} color={colors.brandOrange} />
        <Text style={[styles.title, { color: colors.foreground }]}>Connexion admin</Text>
        <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Input label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
        <Button
          title="Se connecter"
          variant="brand"
          size="lg"
          fullWidth
          loading={login.isPending}
          disabled={!email || !password}
          onPress={() => login.mutate()}
          style={{ marginTop: 8 }}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { paddingTop: 32, gap: 8 },
  title: { fontSize: 22, fontWeight: '800', marginVertical: 12, textAlign: 'center' },
});
