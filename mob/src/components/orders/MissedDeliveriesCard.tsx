import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { palette } from '@/theme/tokens';
import { formatDateTime } from '@/utils/format';
import { missedDeliveryLabel, type MissedDelivery } from '@/utils/missedDeliveries';

interface Props {
  missed: MissedDelivery[];
  /** Commande toujours en cours : le livreur repassera. */
  stillInDelivery: boolean;
}

/**
 * Tentatives de livraison manquées (demande du 2026-10-13) : motif et date de
 * chaque passage signalé par le livreur, comme sur le site.
 */
export const MissedDeliveriesCard: React.FC<Props> = ({ missed, stillInDelivery }) => {
  if (missed.length === 0) return null;
  return (
    <Card padding={14} style={[styles.card, { borderColor: palette.orange[300], backgroundColor: palette.orange[50] }]} testID="order-missed-deliveries">
      <View style={styles.head}>
        <AlertTriangle size={18} color={palette.orange[700]} />
        <Text style={[styles.title, { color: palette.orange[900] }]}>Tentative de livraison</Text>
      </View>
      {stillInDelivery ? (
        <Text style={[styles.hint, { color: palette.orange[700] }]}>
          Le livreur n’a pas pu vous remettre la commande. Elle reste en cours de livraison.
        </Text>
      ) : null}
      {missed.map((m, index) => (
        <View key={`${m.date ?? ''}-${index}`} style={[styles.entry, { borderColor: palette.orange[200] }]}>
          <Text style={[styles.label, { color: palette.orange[900] }]}>{missedDeliveryLabel(index)}</Text>
          {m.date ? (
            <Text style={[styles.date, { color: palette.orange[700] }]}>{formatDateTime(m.date)}</Text>
          ) : null}
          {m.reason?.trim() ? (
            <Text style={[styles.reason, { color: palette.slate[800] }]}>
              <Text style={{ fontWeight: '700' }}>Motif : </Text>
              {m.reason.trim()}
            </Text>
          ) : null}
        </View>
      ))}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginTop: 12, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 6 },
  entry: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  label: { fontSize: 14, fontWeight: '700' },
  date: { fontSize: 12, marginTop: 2 },
  reason: { fontSize: 14, lineHeight: 20, marginTop: 6 },
});
