import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Crown, Gem, Award, User } from 'lucide-react-native';
import type { IconComponent } from '@/types/icon';

const TIER_CONFIG: Record<
  string,
  { label: string; bg: string; fg: string; Icon: IconComponent }
> = {
  normal: { label: 'Standard', bg: '#E2E8F0', fg: '#0F172A', Icon: User },
  argent: { label: 'Argent', bg: '#CBD5E1', fg: '#0F172A', Icon: Award },
  or: { label: 'Or', bg: '#FCD34D', fg: '#7C2D12', Icon: Crown },
  diamant: { label: 'Diamant', bg: '#A5F3FC', fg: '#0E7490', Icon: Gem },
};

export const TierBadge: React.FC<{ tier?: string; small?: boolean }> = ({ tier = 'normal', small }) => {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.normal!;
  const Icon = cfg.Icon;
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: cfg.bg,
          paddingHorizontal: small ? 8 : 12,
          paddingVertical: small ? 3 : 6,
        },
      ]}
    >
      <Icon size={small ? 12 : 14} color={cfg.fg} />
      <Text style={{ color: cfg.fg, fontWeight: '700', fontSize: small ? 11 : 13 }}>
        {cfg.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
});
