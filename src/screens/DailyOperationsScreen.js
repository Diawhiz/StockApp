import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LoadingSpinner } from '../components/common/UIComponents';
import { useDate } from '../context/DateContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../styles/theme';
import { getDeliveriesByDate } from '../database/deliveriesRepo';
import { getExpensesByDate } from '../database/expensesRepo';
import { getAllVendors } from '../database/vendorsRepo';

// Helper: format number to Naira
const formatNaira = (num) => {
  if (num === undefined || num === null) return '0';
  return Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function DailyOperationsScreen() {
  const { theme } = useTheme();
  const { selectedDate } = useDate();

  const [deliveries, setDeliveries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dels, exps, vends] = await Promise.all([
        getDeliveriesByDate(selectedDate),
        getExpensesByDate(selectedDate),
        getAllVendors(),
      ]);
      setDeliveries(dels);
      setExpenses(exps);
      setVendors(vends);
    } catch (e) {
      console.error('Failed to load daily operations data', e);
      Alert.alert('Error', 'Failed to load daily operations. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return <LoadingSpinner text="Loading day's operations..." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        style={[{ flex: 1, backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBar}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Daily Operations</Text>
          {/* Read-only: no add delivery/button since app is read-only */}
        </View>

        <Text style={[styles.screenTitle, { color: theme.text }]}>Deliveries</Text>

        {/* Delivered Orders List - read-only display */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Deliveries for {selectedDate}</Text>
          {deliveries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ color: theme.textMuted, fontStyle: 'italic' }}>
                No deliveries recorded for this date.
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1, overflow: 'auto' }}>
              {deliveries.map((d) => (
                <View
                  key={d.id}
                  style={styles.deliveryItem}
                  onPress={() => Alert.alert('Delivery', `Location: ${d.location}\nRider: ${d.rider}\nProduct: ${d.productDetails}`)}
                >
                  <View style={styles.deliveryHeader}>
                    <Text style={styles.deliveryRider}>{d.rider}</Text>
                    <Text style={styles.deliveryDate}>{d.date}</Text>
                  </View>
                  <Text style={styles.deliveryLocation}>Location: ${d.location}</Text>
                  <Text style={styles.deliveryProduct}>Product: ${d.productDetails}</Text>
                  <Text style={styles.deliveryPrice}>Price: ${formatNaira(d.price)}</Text>
                  {d.items && d.items.length > 0 && (
                    <View style={styles.deliveryItems}>
                      {d.items.map((item) => (
                        <View key={item.id} style={styles.deliveryItemRow}>
                          <Text style={styles.deliveryItemName}>{item.item_name_snapshot}</Text>
                          <Text style={styles.deliveryItemQty}>× {item.quantity}</Text>
                          <Text style={styles.deliveryItemPrice}>{formatNaira(item.unit_price_cents / 100)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={[styles.screenTitle, { color: theme.text }]}>Expenses</Text>

        {/* Expenses List - read-only display */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Expenses for {selectedDate}</Text>
          {expenses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ color: theme.textMuted, fontStyle: 'italic' }}>
                No expenses recorded for this date.
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1, overflow: 'auto' }}>
              {expenses.map((exp) => (
                <View key={exp.id} style={styles.expenseItem}>
                  <Text style={styles.expenseDesc}>{exp.description}</Text>
                  <Text style={styles.expenseAmount}>{formatNaira(exp.amount)}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 10 }}>
                    {exp.date}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bottom summary */}
        <View style={styles.summaryBar}>
          <Text style={styles.summaryTitle}>Summary</Text>
          <View style={styles.summaryItems}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Deliveries</Text>
              <Text style={styles.summaryValue}>{deliveries.length}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Expenses</Text>
              <Text style={styles.summaryValue}>{expenses.length}</Text>
            </View>
            {expenses.length > 0 && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total</Text>
                <Text style={styles.summaryValue}>
                  {formatNaira(
                    expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
                  )}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl * 2,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: SPACING.md,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderColor: theme.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: theme.textSecondary,
    marginBottom: SPACING.sm,
  },
  emptyState: {
    padding: SPACING.xl,
    textAlign: 'center',
    color: theme.textMuted,
  },
  summaryBar: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderColor: theme.border,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: theme.textSecondary,
    marginBottom: SPACING.sm,
  },
  summaryItems: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  summaryItem: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: SPACING.sm,
    backgroundColor: theme.surfaceAlt,
    borderRadius: 6,
    minWidth: 100,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: theme.textMuted,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  deliveryItem: {
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  deliveryRider: {
    fontWeight: '700',
    color: theme.primary,
  },
  deliveryDate: {
    fontSize: 12,
    color: theme.textMuted,
  },
  deliveryLocation: {
    fontSize: 13,
    color: theme.text,
    marginBottom: 4,
  },
  deliveryProduct: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  deliveryPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.primary,
    marginBottom: 4,
  },
  deliveryItems: {
    marginTop: SPACING.sm,
  },
  deliveryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.divider,
    marginBottom: 4,
    paddingBottom: 4,
  },
  deliveryItemName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  deliveryItemQty: {
    color: theme.textMuted,
    fontSize: 12,
  },
  deliveryItemPrice: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.divider,
    marginBottom: 4,
    paddingBottom: 4,
  },
  expenseDesc: {
    fontSize: 13,
    color: theme.text,
    flex: 1,
  },
  expenseAmount: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});