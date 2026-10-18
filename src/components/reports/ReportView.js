import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Card, Button } from '../common/UIComponents';
import { generateDailyReportText } from '../../utils/reportFormatter';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

export function ReportView({ date, deliveries = [], expenses = [] }) {
  const { theme } = useTheme();
  const { showToast } = useAlert();

  const reportText = generateDailyReportText({ date, deliveries, expenses });

  const handleCopy = async () => {
    await Clipboard.setStringAsync(reportText);
    showToast('Report Copied!');
  };

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>Full Daily Report</Text>
        <Button
          title="Copy Full Report"
          icon="copy-outline"
          onPress={handleCopy}
          style={styles.copyBtn}
        />
      </View>

      <Text style={[styles.instruction, { color: theme.textMuted }]}>
        Exact formatted reconciliation statement ready for WhatsApp / Telegram / SMS:
      </Text>

      <View style={[styles.previewContainer, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
        <ScrollView style={styles.previewScroll} nestedScrollEnabled>
          <Text style={[styles.previewText, { color: theme.text }]} selectable>
            {reportText}
          </Text>
        </ScrollView>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  copyBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 38,
  },
  instruction: {
    fontSize: 12,
    marginBottom: SPACING.md,
  },
  previewContainer: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    maxHeight: 380,
  },
  previewScroll: {
    maxHeight: 350,
  },
  previewText: {
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },
});
