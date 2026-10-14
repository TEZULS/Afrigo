import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { Mic, X } from 'lucide-react-native';
import { Pressable } from '@/components/ui/Pressable';
import { palette } from '@/theme/tokens';

interface Props {
  visible: boolean;
  /** Dictée reconnue jusqu'ici. */
  transcript: string;
  /** « Arrêter » : cherche ce qui a déjà été dit. */
  onStop: () => void;
  /** Croix : ferme sans chercher. */
  onCancel: () => void;
}

/**
 * Fenêtre d'écoute (demande du 2026-10-03) : un grand micro au centre avec
 * « Parlez », pour que le client sache que la dictée est bien active.
 */
export const VoiceListeningOverlay: React.FC<Props> = ({ visible, transcript, onStop, onCancel }) => {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    pulse.setValue(0);
    loop.start();
    return () => loop.stop();
  }, [pulse, visible]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop} testID="voice-overlay">
        <View style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer la recherche vocale"
            onPress={onCancel}
            hitSlop={10}
            style={styles.close}
            testID="voice-cancel"
          >
            <X size={20} color={palette.slate[500]} />
          </Pressable>

          <View style={styles.micWrap}>
            <Animated.View
              style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Arrêter la recherche vocale"
              onPress={onStop}
              style={styles.mic}
              testID="voice-stop"
            >
              <Mic size={40} color="#FFFFFF" />
            </Pressable>
          </View>

          <Text style={styles.title}>Parlez</Text>
          <Text style={styles.transcript} numberOfLines={3}>
            {transcript || 'Dites le nom du produit recherché'}
          </Text>
          <Text style={styles.hint}>Appuyez sur le micro quand vous avez fini</Text>
        </View>
      </View>
    </Modal>
  );
};

const MIC = 96;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  close: { position: 'absolute', top: 14, right: 14 },
  micWrap: { width: MIC * 1.8, height: MIC * 1.8, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    backgroundColor: palette.brand.orange,
  },
  mic: {
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    backgroundColor: palette.brand.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { marginTop: 4, fontSize: 24, fontWeight: '800', color: palette.slate[900] },
  transcript: {
    marginTop: 10,
    fontSize: 17,
    textAlign: 'center',
    color: palette.slate[700],
    minHeight: 24,
  },
  hint: { marginTop: 14, fontSize: 13, color: palette.slate[400], textAlign: 'center' },
});
