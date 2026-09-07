import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Truck } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { invokeFunction } from '@/api/entities';
import { setBase44Token } from '@/api/base44Client';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/theme/ThemeProvider';
import type { DelivererStackParamList } from '@/navigation/types';
import { authErrorMessage } from '@/lib/authErrors';

interface CustomAuthResponse {
  access_token: string;
  user?: { id: string; role?: string };
}

export const DelivererLoginScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<DelivererStackParamList>>();
  const { colors } = useTheme();
  const toast = useToast();
  const [delivererId, setDelivererId] = useState('');
  const [password, setPassword] = useState('');

  const login = useMutation({
    mutationFn: async () => {
      const r = await invokeFunction<CustomAuthResponse>('handleCustomAuth', {
        action: 'deliverer_login',
        deliverer_id: delivererId,
        password,
      });
      if (!r?.access_token) throw new Error('Identifiants invalides');
      await setBase44Token(r.access_token);
      return r;
    },
    onSuccess: () => {
      toast.success('Bienvenue', 'Connexion réussie');
      nav.replace('DelivererDashboard');
    },
    onError: (e: Error) => toast.error('Connexion impossible', authErrorMessage(e)),
  });

  return (
    <Screen>
      <Header title="Espace livreur" onBack={nav.canGoBack() ? nav.goBack : undefined} />
      <View style={styles.body}>
        <Truck size={48} color={colors.brandOrange} />
        <Text style={[styles.title, { color: colors.foreground }]}>Connexion livreur</Text>
        <Input label="ID livreur" value={delivererId} onChangeText={setDelivererId} autoCapitalize="characters" />
        <Input label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
        <Button
          title="Se connecter"
          variant="brand"
          size="lg"
          fullWidth
          loading={login.isPending}
          disabled={!delivererId || !password}
          onPress={() => login.mutate()}
          style={{ marginTop: 8 }}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  body: { paddingTop: 32, alignItems: 'stretch', gap: 8 },
  title: { fontSize: 22, fontWeight: '800', marginVertical: 12, textAlign: 'center' },
});
