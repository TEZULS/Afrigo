import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { DeliverySlot, invokeFunction } from '@/api/entities';
import { useNow } from '@/hooks/useNow';
import type { ScheduleDay } from '@/utils/deliverySchedule';
import {
  availableTableSlotsToday,
  availableZoneSlotsToday,
  formatDeliveryDay,
  formatSlotRange,
  toYmd,
  type DeliverySlotRow,
  type SlotOption,
} from '@/utils/deliverySlots';

/** Créneau retenu : toujours aujourd'hui (`date`), avec sa plage horaire. */
export interface SlotChoice extends SlotOption {
  date: string;
}

interface Props {
  /** `zone` : horaires de la zone ; `table` : lignes `DeliverySlot`. */
  mode: 'zone' | 'table';
  schedule?: ScheduleDay[];
  value: SlotChoice | null;
  onChange: (choice: SlotChoice | null) => void;
}

/** Les créneaux qui commencent disparaissent d'eux-mêmes : on relit l'heure chaque minute. */
const CLOCK_REFRESH_MS = 60_000;
const NO_COUNTS: Record<string, number> = {};

/**
 * Choix du créneau de livraison **du jour même** : seuls les créneaux
 * d'aujourd'hui pas encore commencés (et pas complets) sont proposés, sans
 * afficher le nombre de places. Le premier créneau libre est présélectionné.
 */
export const DeliverySlotSection: React.FC<Props> = ({ mode, schedule, value, onChange }) => {
  const { colors } = useTheme();
  const now = useNow(CLOCK_REFRESH_MS);
  const today = toYmd(now);

  /** Places prises aujourd'hui par heure de début (« 11h00 » → 3). */
  const countsQuery = useQuery<Record<string, number>>({
    queryKey: ['deliverySlotCounts', today],
    enabled: mode === 'zone',
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      try {
        const res = await invokeFunction<{ counts?: Record<string, number> }>(
          'getDeliverySlotCounts',
          { date: today },
        );
        return res?.counts ?? {};
      } catch {
        // Compteur indisponible : on propose les créneaux sans bloquer la commande.
        return {};
      }
    },
  });

  const tableQuery = useQuery<DeliverySlotRow[]>({
    queryKey: ['delivery-slots'],
    enabled: mode === 'table',
    staleTime: 0,
    queryFn: async () =>
      ((await DeliverySlot().list?.('-date')) as DeliverySlotRow[] | undefined) ?? [],
  });

  const loading = mode === 'zone' ? countsQuery.isLoading : tableQuery.isLoading;
  const counts = countsQuery.data ?? NO_COUNTS;
  const options = useMemo(
    () =>
      mode === 'zone'
        ? availableZoneSlotsToday(schedule, counts, now)
        : availableTableSlotsToday(tableQuery.data ?? [], now),
    [mode, schedule, counts, tableQuery.data, now],
  );

  /*
    Le créneau retenu doit rester proposable (aujourd'hui, pas commencé, pas
    complet) : sinon on présélectionne le premier créneau libre, ou plus rien.
  */
  useEffect(() => {
    if (loading) return;
    const stillOffered =
      value?.date === today &&
      options.some((o) => o.key === value.key && o.time_slot === value.time_slot);
    if (stillOffered) return;
    const first = options[0];
    if (first) onChange({ ...first, date: today });
    else if (value) onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, today, loading]);

  return (
    <View>
      <View style={styles.labelRow}>
        <CalendarDays size={15} color={palette.emerald[600]} />
        <Text style={[styles.label, { color: colors.foreground }]}>Date de livraison</Text>
      </View>
      <View style={styles.dayBox}>
        <Text testID="slot-day-label" style={styles.dayLabel}>
          Aujourd&apos;hui · {formatDeliveryDay(now)}
        </Text>
      </View>

      <View style={[styles.labelRow, { marginTop: 14 }]}>
        <Clock size={15} color={palette.emerald[600]} />
        <Text style={[styles.label, { color: colors.foreground }]}>Créneau de livraison</Text>
      </View>
      {loading ? (
        <Text style={[styles.loading, { color: colors.mutedForeground }]}>
          Chargement des créneaux…
        </Text>
      ) : options.length === 0 ? (
        <View style={[styles.notice, { marginTop: 8 }]} testID="slots-none-today">
          <Text style={styles.noticeText}>
            ⚠️ Plus aucun créneau de livraison disponible aujourd&apos;hui. Réessayez demain.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {options.map((o) => {
            const selected = value?.date === today && value.key === o.key;
            const range = formatSlotRange(o.time_slot);
            return (
              <Pressable
                key={o.key}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Créneau ${range}`}
                testID={`slot-${o.key}`}
                onPress={() => onChange({ ...o, date: today })}
                style={[
                  styles.card,
                  selected
                    ? { borderColor: palette.emerald[500], backgroundColor: palette.emerald[50] }
                    : { borderColor: palette.slate[200], backgroundColor: colors.background },
                ]}
              >
                <Text
                  style={[
                    styles.cardTime,
                    { color: selected ? palette.emerald[900] : palette.slate[700] },
                  ]}
                >
                  {range}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 13, fontWeight: '700' },
  dayBox: {
    marginTop: 8,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.emerald[200],
    backgroundColor: palette.emerald[50],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  dayLabel: { fontSize: 15, fontWeight: '700', color: palette.emerald[900] },
  loading: { marginTop: 8, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  card: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  cardTime: { fontSize: 14, fontWeight: '700' },
  notice: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.orange[200],
    backgroundColor: palette.orange[50],
    padding: 12,
  },
  noticeText: { fontSize: 13, color: palette.orange[700] },
});
