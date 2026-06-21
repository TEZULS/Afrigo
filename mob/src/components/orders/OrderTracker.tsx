import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, Circle, Truck, PackageCheck, ChefHat, ShoppingBag } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import type { IconComponent } from '@/types/icon';

interface Step {
  key: string;
  label: string;
  Icon: IconComponent;
}

const STEPS: Step[] = [
  { key: 'pending', label: 'Reçue', Icon: ShoppingBag },
  { key: 'preparing', label: 'Préparation', Icon: ChefHat },
  { key: 'shipped', label: 'Livraison', Icon: Truck },
  { key: 'delivered', label: 'Livrée', Icon: PackageCheck },
];

const ORDER: Record<string, number> = {
  pending: 0,
  confirmed: 0,
  preparing: 1,
  ready: 1,
  shipped: 2,
  out_for_delivery: 2,
  delivered: 3,
  cancelled: -1,
  not_delivered: -1,
  failed_delivery: -1,
};

export const OrderTracker: React.FC<{ status: string }> = ({ status }) => {
  const { colors } = useTheme();
  const idx = ORDER[status] ?? 0;
  const cancelled = idx === -1;

  return (
    <View style={styles.container}>
      {STEPS.map((s, i) => {
        const reached = !cancelled && i <= idx;
        const active = !cancelled && i === idx;
        return (
          <React.Fragment key={s.key}>
            <View style={styles.step}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: reached ? palette.brand.green : colors.muted,
                    borderColor: active ? palette.brand.orange : 'transparent',
                  },
                ]}
              >
                {reached ? (
                  <CheckCircle2 size={18} color="#FFF" />
                ) : (
                  <Circle size={18} color={colors.mutedForeground} />
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  { color: reached ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {s.label}
              </Text>
            </View>
            {i < STEPS.length - 1 ? (
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor:
                      !cancelled && i < idx ? palette.brand.green : colors.border,
                  },
                ]}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
  },
  step: { alignItems: 'center', width: 64 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: 6, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  connector: { flex: 1, height: 2, marginTop: 17 },
});
