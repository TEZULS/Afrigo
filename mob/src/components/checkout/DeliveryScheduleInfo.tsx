import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { getNextDelivery, isCurrentlyInSlot, type ScheduleDay } from '@/utils/deliverySchedule';

interface Props {
  schedule?: ScheduleDay[];
  minDaysBeforeDelivery?: number;
}

/**
 * Bloc « Prochaine livraison disponible » affiché au checkout dès qu'une zone
 * de livraison est reconnue. Équivalent mobile de
 * `src/components/checkout/DeliveryScheduleInfo.jsx`.
 */
export const DeliveryScheduleInfo: React.FC<Props> = ({ schedule, minDaysBeforeDelivery = 0 }) => {
  const { scheme } = useTheme();
  const next = getNextDelivery(schedule, minDaysBeforeDelivery);
  if (!next) return null;

  const dark = scheme === 'dark';
  const containerBg = dark ? 'rgba(6,78,59,0.35)' : palette.emerald[50];
  const containerBorder = dark ? palette.emerald[700] : palette.emerald[200];
  const titleColor = dark ? palette.emerald[200] : palette.emerald[700];
  const boxBg = next.isToday
    ? dark
      ? 'rgba(4,120,87,0.45)'
      : palette.emerald[100]
    : dark
      ? 'rgba(2,6,23,0.35)'
      : palette.white;
  const boxBorder = next.isToday
    ? dark
      ? palette.emerald[600]
      : palette.emerald[200]
    : dark
      ? palette.emerald[700]
      : palette.emerald[100];
  const labelColor = next.isToday
    ? dark
      ? palette.emerald[100]
      : palette.emerald[700]
    : dark
      ? palette.slate[100]
      : palette.slate[800];

  return (
    <View
      style={[styles.container, { backgroundColor: containerBg, borderColor: containerBorder }]}
    >
      <View style={styles.titleRow}>
        <Clock size={15} color={titleColor} />
        <Text style={[styles.title, { color: titleColor }]}>Prochaine livraison disponible</Text>
      </View>

      <View style={[styles.box, { backgroundColor: boxBg, borderColor: boxBorder }]}>
        <View style={styles.dateRow}>
          {next.offset >= 2 ? (
            <Text style={[styles.label, { color: dark ? palette.slate[100] : palette.slate[900] }]}>
              {next.dateStr}
            </Text>
          ) : null}
          <Text style={[styles.label, { color: labelColor }]}>{next.label}</Text>
          {next.isToday ? (
            <View style={[styles.badge, { backgroundColor: palette.emerald[500] }]}>
              <Text style={styles.badgeText}>En cours</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.slots}>
          {next.slots.length > 0 ? (
            next.slots.map((slot) => {
              const active = next.isToday && isCurrentlyInSlot(slot);
              return (
                <View
                  key={slot}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active
                        ? palette.emerald[500]
                        : dark
                          ? 'rgba(16,185,129,0.18)'
                          : palette.emerald[100],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: active
                          ? palette.white
                          : dark
                            ? palette.emerald[200]
                            : palette.emerald[700],
                      },
                    ]}
                  >
                    {active ? '🟢 ' : ''}
                    {slot}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={[styles.wholeDay, { color: titleColor }]}>Journée entière</Text>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  title: { fontSize: 13, fontWeight: '700' },
  box: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  label: { fontSize: 15, fontWeight: '800' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 11, fontWeight: '600' },
  wholeDay: { fontSize: 11, fontStyle: 'italic' },
});
