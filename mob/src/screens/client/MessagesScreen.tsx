import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Pressable,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Send, Headphones, Phone, Camera, ArrowLeft } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { Message } from '@/api/entities';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { useAppSettings } from '@/hooks/useAppSettings';
import { palette } from '@/theme/tokens';
import { formatDate } from '@/utils/format';
import type { RootStackParamList } from '@/navigation/types';

interface ChatMessage {
  id: string;
  text: string;
  from: 'user' | 'admin';
  created_date?: string;
}

const formatChatTime = (iso?: string) => (iso ? formatDate(iso, 'HH:mm') : '');

export const MessagesScreen: React.FC = () => {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const settings = useAppSettings();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState('');

  const supportPhone = settings.data?.support_phone ?? '';

  const callSupport = async () => {
    const number = supportPhone.replace(/\s/g, '');
    if (!number) {
      Alert.alert('Indisponible', 'Aucun numéro de service client configuré.');
      return;
    }
    const url = `tel:${number}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
    else Alert.alert('Erreur', "Impossible d'ouvrir l'application téléphone.");
  };

  const pickPhoto = () => {
    /**
     * Laisse le choix entre prendre une photo ou choisir dans la galerie.
     */
    Alert.alert(
      'Joindre une photo',
      'Comment souhaitez-vous joindre la photo ?',
      [
        {
          text: 'Prendre une photo',
          onPress: async () => {
            const perms = await ImagePicker.requestCameraPermissionsAsync();
            if (!perms.granted) {
              Alert.alert(
                'Caméra refusée',
                "L'accès à l'appareil photo est requis pour prendre une photo.",
              );
              return;
            }
            const r = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.7,
            });
            if (!r.canceled && r.assets[0]?.uri) {
              Alert.alert(
                'Photo capturée',
                "L'envoi de pièces jointes arrive bientôt.",
              );
            }
          },
        },
        {
          text: 'Choisir dans la galerie',
          onPress: async () => {
            const perms = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perms.granted) {
              Alert.alert(
                'Galerie refusée',
                "L'accès à la galerie est requis pour envoyer une photo.",
              );
              return;
            }
            const r = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.7,
            });
            if (!r.canceled && r.assets[0]?.uri) {
              Alert.alert(
                'Photo sélectionnée',
                "L'envoi de pièces jointes arrive bientôt.",
              );
            }
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ],
    );
  };

  const query = useQuery<ChatMessage[]>({
    queryKey: ['messages', user?.email],
    enabled: Boolean(user?.email),
    refetchInterval: 10_000,
    queryFn: async () => {
      const rows = (await Message().filter?.({ customer_email: user!.email })) as Array<{
        id: string;
        content?: string;
        sender_type?: string;
        created_date?: string;
      }>;
      const list = (rows ?? []).map((m) => ({
        id: m.id,
        text: m.content ?? '',
        from: (m.sender_type === 'admin' ? 'admin' : 'user') as 'admin' | 'user',
        created_date: m.created_date,
      }));
      /**
       * Tri chronologique ASCENDANT : le plus ancien en haut, le plus récent
       * en bas — comme une conversation WhatsApp. Sans tri, le backend
       * peut retourner les messages dans n'importe quel ordre, ce qui faisait
       * apparaître les réponses admin (17:28) au-dessus des messages plus
       * anciens du client (10:49 / 10:52).
       */
      list.sort((a, b) => {
        const ta = a.created_date ? new Date(a.created_date).getTime() : 0;
        const tb = b.created_date ? new Date(b.created_date).getTime() : 0;
        return ta - tb;
      });
      return list;
    },
  });

  useEffect(() => {
    if (query.data && query.data.length > 0) {
      listRef.current?.scrollToEnd({ animated: false });
    }
  }, [query.data?.length]);

  const send = useMutation({
    mutationFn: async () => {
      await Message().create?.({
        customer_email: user!.email,
        content: text.trim(),
        sender_type: 'customer',
      });
    },
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['messages', user?.email] });
    },
  });

  if (!user) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style="dark" />
        <Header onBack={nav.goBack} title="Chat AfriGo" />
        <View style={{ padding: 16 }}>
          <Button
            title="Se connecter pour discuter"
            variant="brand"
            fullWidth
            onPress={() => nav.navigate('Login')}
          />
        </View>
      </SafeAreaView>
    );
  }

  /**
   * Bandeau vert épinglé avec icône casque, libellé "Le service client AfriGo"
   * et bouton "Appeler" — reproduit le design web.
   */
  const ServiceBanner = (
    <View style={[styles.banner, { backgroundColor: palette.emerald[500] }]}>
      <View style={styles.bannerLeft}>
        <View style={[styles.bannerIcon, { backgroundColor: palette.emerald[600] }]}>
          <Headphones size={20} color="#FFF" />
        </View>
        <Text style={styles.bannerTitle} numberOfLines={1}>
          Le service client AfriGo
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Appeler le service client"
        onPress={callSupport}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        style={({ pressed }) => [
          styles.callBtn,
          { backgroundColor: palette.emerald[600] },
          Platform.OS === 'ios' && pressed && { opacity: 0.85 },
        ]}
      >
        <Phone size={14} color="#FFF" />
        <Text style={styles.callBtnTxt}>Appeler</Text>
      </Pressable>
    </View>
  );

  /**
   * Composer : icône caméra (galerie) à gauche, input au milieu, bouton vert
   * arrondi avec icône avion à droite.
   */
  const Composer = (
    <View
      style={[
        styles.composer,
        {
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Joindre une photo"
        onPress={pickPhoto}
        style={[styles.cameraBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
        android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true, radius: 24 }}
      >
        <Camera size={18} color={colors.foreground} />
      </Pressable>

      <View
        style={[
          styles.inputWrap,
          { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
        ]}
      >
        <TextInput
          ref={inputRef}
          accessibilityLabel="Écrivez votre message"
          placeholder="Écrivez votre message…"
          placeholderTextColor={colors.mutedForeground}
          value={text}
          onChangeText={setText}
          style={[styles.input, { color: colors.foreground }]}
          multiline
          onFocus={() =>
            requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
          }
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Envoyer le message"
        onPress={() => text.trim() && send.mutate()}
        disabled={!text.trim() || send.isPending}
        style={[
          styles.sendBtn,
          {
            backgroundColor: text.trim() ? palette.emerald[400] : palette.emerald[200],
            opacity: send.isPending ? 0.6 : 1,
          },
        ]}
        android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true, radius: 24 }}
      >
        <Send size={18} color="#FFF" strokeWidth={2.4} />
      </Pressable>
    </View>
  );

  return (
    /*
      On bypasse le composant `Screen` (qui contient son propre KAV) pour
      éviter d'avoir deux KAV imbriqués qui se neutralisent. On utilise
      directement `SafeAreaView` + `KeyboardAvoidingView behavior="padding"`
      → sur les deux plateformes, le composer est poussé au-dessus du
      clavier de manière fiable.
    */
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <StatusBar style="dark" />
      <Header title="Chat AfriGo" />
      <Pressable
        accessibilityRole="link"
        onPress={() => (nav.canGoBack() ? nav.goBack() : nav.navigate('Contact'))}
        style={styles.backRow}
        hitSlop={6}
      >
        <ArrowLeft size={18} color={colors.foreground} />
        <Text style={[styles.backTxt, { color: colors.foreground }]}>Retour au contact</Text>
      </Pressable>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        {ServiceBanner}

        {query.isLoading ? (
          <Loader />
        ) : (
          <FlatList
            ref={listRef}
            data={query.data}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{
              padding: 16,
              gap: 8,
              flexGrow: 1,
              justifyContent: 'flex-end',
            }}
            renderItem={({ item }) => {
              const isUser = item.from === 'user';
              const bg = isUser ? palette.emerald[500] : palette.brand.orange;
              return (
                <View
                  style={[
                    styles.bubble,
                    {
                      backgroundColor: bg,
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: '#FFF',
                      fontSize: 14,
                      lineHeight: 20,
                    }}
                  >
                    {item.text}
                  </Text>
                  {item.created_date ? (
                    <Text style={[styles.timestamp, { color: 'rgba(255,255,255,0.85)' }]}>
                      {formatChatTime(item.created_date)}
                    </Text>
                  ) : null}
                </View>
              );
            }}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          />
        )}
        {Composer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backTxt: { fontSize: 14, fontWeight: '600' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  bannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: { color: '#FFF', fontWeight: '800', fontSize: 14, flexShrink: 1 },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  callBtnTxt: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  bubble: {
    padding: 10,
    borderRadius: 16,
    maxWidth: '80%',
    minWidth: 64,
  },
  timestamp: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  cameraBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 44,
    maxHeight: 110,
    justifyContent: 'center',
  },
  input: {
    fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
