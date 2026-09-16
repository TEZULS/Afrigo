import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FileText, CheckCircle2, PackageCheck, XCircle } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';
import { RETURN_STEPS, returnStepIndex } from '@/utils/returnStatus';
import type { IconComponent } from '@/types/icon';

const STEP_ICONS: Record<string, IconComponent> = {
  pending: FileText,
  approved: CheckCircle2,
  completed: PackageCheck,
};

interface Props {
  status?: string | null;
  /** Motif saisi par l'admin quand la demande est refusée. */
  rejectionReason?: string | null;
}

/**
 * Suivi d'une demande de retour : En attente → Approuvé → Terminé (même
 * parcours que le `ReturnTracker` du web). « Approuvé » s'allume quand l'admin
 * accepte la demande, « Terminé » quand il la clôture (remboursement crédité).
 * Une demande refusée remplace le suivi par un encart explicatif.
 */
export const ReturnTracker: React.FC<Props> = ({ status, rejectionReason }) => {
  const { colors } = useTheme();
  const idx = returnStepIndex(status);

  if (idx === -1) {
    return (
      <View
        testID="return-tracker-rejected"
        style={[styles.rejected, { backgroundColor: palette.rose[50], borderColor: palette.rose[200] }]}
      >
        <View style={[styles.rejectedIcon, { backgroundColor: palette.rose[100] }]}>
          <XCircle size={26} color={palette.rose[600]} />
        </View>
        <Text style={[styles.rejectedTitle, { color: palette.rose[700] }]}>Demande refusée</Text>
        <Text style={[styles.rejectedText, { color: palette.rose[600] }]}>
          Votre demande de retour a été refusée.
        </Text>
        {rejectionReason ? (
          <View style={[styles.rejectedReason, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Motif</Text>
            <Text style={{ color: colors.foreground, marginTop: 2, lineHeight: 20 }}>
              {rejectionReason}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container} testID="return-tracker">
      {RETURN_STEPS.map((s, i) => {
        const reached = i <= idx;
        const active = i === idx;
        const Icon = STEP_ICONS[s.key] ?? FileText;
        return (
          <React.Fragment key={s.key}>
            <View style={styles.step} testID={`return-step-${s.key}-${reached ? 'done' : 'todo'}`}>
              <View
                style={[
                  styles.iconWrap,
                  {
                    backgroundColor: reached ? palette.brand.green : colors.muted,
                    borderColor: active ? palette.brand.orange : 'transparent',
                  },
                ]}
              >
                <Icon size={18} color={reached ? '#FFF' : colors.mutedForeground} />
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: reached ? colors.foreground : colors.mutedForeground,
                    fontWeight: active ? '800' : '600',
                  },
                ]}
              >
                {s.label}
              </Text>
            </View>
            {i < RETURN_STEPS.length - 1 ? (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: i < idx ? palette.brand.green : colors.border },
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
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  step: { alignItems: 'center', width: 76 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { marginTop: 6, fontSize: 11, textAlign: 'center' },
  connector: { flex: 1, height: 2, marginTop: 18 },
  rejected: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  rejectedIcon: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  rejectedTitle: { fontSize: 16, fontWeight: '800' },
  rejectedText: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  rejectedReason: {
    alignSelf: 'stretch',
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
});
