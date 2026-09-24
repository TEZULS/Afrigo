import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { DeliverySlot, invokeFunction } from '@/api/entities';
import { useNow } from '@/hooks/useNow';
import type { ScheduleDay } from '@/utils/deliverySchedule';
import {
  availableZoneSlotsOn,
  formatRelativeDeliveryDay,
  formatSlotRange,
  nextTableSlots,
  toYmd,
  zoneCandidateDays,
  type DeliverySlotRow,
  type SlotOption,
} from '@/utils/deliverySlots';

/** Créneau retenu : jour (`2026-09-23`) et plage horaire. */
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

/** `2026-09-24` → minuit local de ce jour. */
const fromYmd = (ymd: string): Date => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

/**
 * Choix du créneau de livraison sur **un seul jour** : aujourd'hui tant qu'il
 * reste un créneau pas encore commencé, sinon automatiquement le prochain jour
 * livrable (« Demain · Jeudi 24 Sept. »). Le nombre de places n'est pas
 * affiché ; un créneau complet n'est pas proposé. Le premier créneau libre est
 * présélectionné.
 */
export const DeliverySlotSection: React.FC<Props> = ({ mode, schedule, value, onChange }) => {
  const { colors } = useTheme();
  const now = useNow(CLOCK_REFRESH_MS);

  // --- Horaires de zone : jours candidats, un jour complet est sauté. ---
  const candidates = useMemo(
    () => (mode === 'zone' ? zoneCandidateDays(schedule, now) : []),
    [mode, schedule, now],
  );
  const candidatesKey = candidates.map(toYmd).join(',');
  const [candidateIndex, setCandidateIndex] = useState(0);
  // Liste des jours modifiée (heure qui tourne, autre zone) : on repart du premier.
  useEffect(() => setCandidateIndex(0), [candidatesKey]);
  const zoneDay = candidates[candidateIndex] ?? null;
  const zoneYmd = zoneDay ? toYmd(zoneDay) : '';

  /** Places prises ce jour-là par heure de début (« 11h00 » → 3). */
  const countsQuery = useQuery<Record<string, number>>({
    queryKey: ['deliverySlotCounts', zoneYmd],
    enabled: mode === 'zone' && Boolean(zoneYmd),
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      try {
        const res = await invokeFunction<{ counts?: Record<string, number> }>(
          'getDeliverySlotCounts',
          { date: zoneYmd },
        );
        return res?.counts ?? {};
      } catch {
        // Compteur indisponible : on propose les créneaux sans bloquer la commande.
        return {};
      }
    },
  });

  // --- Table DeliverySlot : premier jour qui a un créneau proposable. ---
  const tableQuery = useQuery<DeliverySlotRow[]>({
    queryKey: ['delivery-slots'],
    enabled: mode === 'table',
    staleTime: 0,
    queryFn: async () =>
      ((await DeliverySlot().list?.('-date')) as DeliverySlotRow[] | undefined) ?? [],
  });

  const counts = countsQuery.data ?? NO_COUNTS;
  const { date, options } = useMemo((): { date: string; options: SlotOption[] } => {
    if (mode === 'table') return nextTableSlots(tableQuery.data ?? [], now) ?? { date: '', options: [] };
    if (!zoneDay) return { date: '', options: [] };
    return { date: zoneYmd, options: availableZoneSlotsOn(schedule, zoneDay, counts, now) };
  }, [mode, tableQuery.data, now, zoneDay, zoneYmd, schedule, counts]);

  const loading =
    mode === 'zone' ? Boolean(zoneYmd) && countsQuery.isLoading : tableQuery.isLoading;

  // Jour complet (toutes les places prises) : on passe au jour livrable suivant.
  useEffect(() => {
    if (mode !== 'zone' || loading || !zoneDay || options.length > 0) return;
    if (candidateIndex < candidates.length - 1) setCandidateIndex(candidateIndex + 1);
  }, [mode, loading, zoneDay, options.length, candidateIndex, candidates.length]);

  /*
    Le créneau retenu doit rester proposable : sinon on présélectionne le
    premier créneau libre du jour affiché, ou plus rien.
  */
  useEffect(() => {
    if (loading) return;
    const stillOffered =
      value?.date === date &&
      options.some((o) => o.key === value.key && o.time_slot === value.time_slot);
    if (stillOffered) return;
    const first = options[0];
    if (first && date) onChange({ ...first, date });
    else if (value) onChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, date, loading]);

  const hasOptions = Boolean(date) && options.length > 0;

  return (
    <View>
      <View style={styles.labelRow}>
        <CalendarDays size={15} color={palette.emerald[600]} />
        <Text style={[styles.label, { color: colors.foreground }]}>Date de livraison</Text>
      </View>
      <View style={styles.dayBox}>
        <Text testID="slot-day-label" style={styles.dayLabel}>
          {hasOptions ? formatRelativeDeliveryDay(fromYmd(date), now) : '—'}
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
      ) : !hasOptions ? (
        <View style={[styles.notice, { marginTop: 8 }]} testID="slots-none">
          <Text style={styles.noticeText}>
            ⚠️ Aucun créneau de livraison disponible pour le moment. Réessayez plus tard.
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {options.map((o) => {
            const selected = value?.date === date && value.key === o.key;
            const range = formatSlotRange(o.time_slot);
            return (
              <Pressable
                key={o.key}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Créneau ${range}`}
                testID={`slot-${o.key}`}
                onPress={() => onChange({ ...o, date })}
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
