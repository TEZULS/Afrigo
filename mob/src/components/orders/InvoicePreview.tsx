import React, { useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Download, X } from 'lucide-react-native';
import { Pressable } from '@/components/ui/Pressable';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { useToast } from '@/hooks/useToast';
import { userErrorMessage } from '@/lib/userErrors';
import {
  buildInvoiceHtml,
  orderNumber,
  shareOrderInvoice,
  type InvoiceCustomer,
  type InvoiceOrder,
} from '@/services/invoice';

interface Props {
  visible: boolean;
  order: InvoiceOrder;
  customer?: InvoiceCustomer | null;
  onClose: () => void;
}

/**
 * Aperçu de la facture avant téléchargement (demande du 2026-10-01) : la
 * facture s'affiche d'abord en plein écran, puis « Télécharger » génère le PDF
 * et ouvre le partage (Fichiers, mail…).
 */
export const InvoicePreview: React.FC<Props> = ({ visible, order, customer, onClose }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const html = useMemo(() => (visible ? buildInvoiceHtml(order, customer) : ''), [visible, order, customer]);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await shareOrderInvoice(order, customer ?? undefined);
    } catch (e) {
      toast.error(
        'Facture indisponible',
        userErrorMessage(e, 'La facture n’a pas pu être générée. Réessayez dans un instant.'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={[styles.head, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Facture {orderNumber(order)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer l’aperçu"
            onPress={onClose}
            hitSlop={10}
            testID="invoice-preview-close"
          >
            <X size={22} color={colors.foreground} />
          </Pressable>
        </View>
        {visible ? (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            style={styles.web}
            testID="invoice-preview"
          />
        ) : null}
        <View style={styles.footer}>
          <Button
            title={busy ? 'Préparation…' : 'Télécharger'}
            variant="brand"
            fullWidth
            loading={busy}
            disabled={busy}
            leftIcon={<Download size={16} color="#FFFFFF" />}
            onPress={() => void download()}
            testID="invoice-download"
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '800' },
  web: { flex: 1 },
  footer: { paddingHorizontal: 16, paddingTop: 12 },
});
