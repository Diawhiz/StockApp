import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../common/UIComponents';
import { formatNaira } from '../../utils/currency';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

export function ReconciliationCard({ totalSales = 0, totalExpenses = 0 }) {
  const { theme } = useTheme();
  const finalTransfer = totalSales - totalExpenses;

  return (
    <Card style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>Daily Reconciliation</Text>
      
      <View style={styles.grid}>
        {/* Sales Block */}
        <View style={[styles.statBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <View style={styles.statHeader}>
            <Ionicons name="cart-outline" size={16} color={theme.primary} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Sales</Text>
          </View>
          <Text style={[styles.statValue, { color: theme.primary }]}>
            {formatNaira(totalSales)}
          </Text>
          <Text style={[styles.statHint, { color: theme.textMuted }]}>
            Sum of orders (excl. fees)
          </Text>
        </View>

        {/* Expenses Block */}
        <View style={[styles.statBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <View style={styles.statHeader}>
            <Ionicons name="receipt-outline" size={16} color={theme.danger} />
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Expenses</Text>
          </View>
          <Text style={[styles.statValue, { color: theme.danger }]}>
            {formatNaira(totalExpenses)}
          </Text>
          <Text style={[styles.statHint, { color: theme.textMuted }]}>
            Operational costs paid
          </Text>
        </View>
      </View>

      {/* Final Transfer Card */}
      <View
        style={[
          styles.transferBox,
          {
            backgroundColor: finalTransfer >= 0 ? theme.successLight : theme.dangerLight,
            borderColor: finalTransfer >= 0 ? theme.success : theme.danger,
          },
        ]}
      >
        <Text
          style={[
            styles.transferLabel,
            { color: finalTransfer >= 0 ? theme.success : theme.danger },
          ]}
        >
          FINAL TRANSFER AMOUNT
        </Text>
        <Text
          style={[
            styles.transferValue,
            { color: finalTransfer >= 0 ? theme.success : theme.danger },
          ]}
        >
          {formatNaira(finalTransfer)}
        </Text>
        <Text style={[styles.formulaText, { color: theme.textSecondary }]}>
          Sales ({formatNaira(totalSales)}) - Expenses ({formatNaira(totalExpenses)})
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  grid: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statBox: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  statHint: {
    fontSize: 10,
    fontWeight: '500',
  },
  transferBox: {
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  transferLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  transferValue: {
    fontSize: 26,
    fontWeight: '900',
    marginVertical: 4,
  },
  formulaText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
