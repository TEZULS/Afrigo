import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { parseLegalContent, splitBold } from '@/utils/legalDocuments';

interface Props {
  content: string | null | undefined;
}

/**
 * Rendu d'un document légal (règlement intérieur en Markdown, politique de
 * confidentialité en texte brut) : titres, paragraphes, puces, séparateurs,
 * gras. Volontairement minimal — pas de dépendance Markdown.
 */
export const LegalContent: React.FC<Props> = ({ content }) => {
  const { colors } = useTheme();
  const blocks = useMemo(() => parseLegalContent(content), [content]);

  const renderSpans = (text: string) =>
    splitBold(text).map((s, i) => (
      <Text key={i} style={s.bold ? styles.bold : undefined}>
        {s.text}
      </Text>
    ));

  return (
    <View>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading':
            return (
              <Text
                key={i}
                style={[
                  styles.heading,
                  b.level === 1 ? styles.h1 : b.level === 2 ? styles.h2 : styles.h3,
                  { color: colors.foreground },
                ]}
              >
                {renderSpans(b.text)}
              </Text>
            );
          case 'bullet':
            return (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.bulletDot, { color: colors.mutedForeground }]}>•</Text>
                <Text style={[styles.paragraph, styles.bulletText, { color: colors.foreground }]}>
                  {renderSpans(b.text)}
                </Text>
              </View>
            );
          case 'rule':
            return <View key={i} style={[styles.rule, { backgroundColor: colors.border }]} />;
          default:
            return (
              <Text key={i} style={[styles.paragraph, { color: colors.foreground }]}>
                {renderSpans(b.text)}
              </Text>
            );
        }
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  heading: { fontWeight: '800', marginTop: 14, marginBottom: 6 },
  h1: { fontSize: 19, lineHeight: 25 },
  h2: { fontSize: 16, lineHeight: 22 },
  h3: { fontSize: 14, lineHeight: 20 },
  paragraph: { fontSize: 14, lineHeight: 21, marginBottom: 8 },
  bold: { fontWeight: '700' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 4 },
  bulletDot: { width: 14, fontSize: 14, lineHeight: 21 },
  bulletText: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
});
