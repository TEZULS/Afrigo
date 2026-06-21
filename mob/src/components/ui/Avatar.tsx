import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { User } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { initials } from '@/utils/format';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
}

export const Avatar: React.FC<AvatarProps> = ({ uri, name, size = 40 }) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.muted },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : initials(name) ? (
        <Text style={{ color: colors.foreground, fontWeight: '700', fontSize: size / 3 }}>
          {initials(name)}
        </Text>
      ) : (
        <User size={Math.round(size * 0.42)} color={colors.mutedForeground} strokeWidth={2.25} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
