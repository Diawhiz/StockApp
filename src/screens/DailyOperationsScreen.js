import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { DeliveryForm } from '../components/operations/DeliveryForm';
import { ExpenseForm } from '../components/operations/ExpenseForm';
import { DeliveredOrdersList } from '../components/operations/DeliveredOrdersList';
import { ExpensesList } from '../components/operations/ExpensesList';
import { LoadingSpinner } from '../components/common/UIComponents';
import { getDeliveriesByDate } from '../database/deliveriesRepo';
import { getExpensesByDate } from '../database/expensesRepo';
import { getAllVendors } from '../database/vendorsRepo';
import { useDate } from '../context/DateContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../styles/theme';

export function DailyOperationsScreen() {
  const { theme } = useTheme();
  const { selectedDate } = useDate();

  const [deliveries, setDeliveries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editingDelivery, setEditingDelivery] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    setLoading(true);
    setEditingDelivery(null);
    setEditingExpense(null);
    loadData();
  }, [selectedDate, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) {
    return <LoadingSpinner text="Loading day's operations..." />;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
      keyboardShouldPersistTaps="handled"
    >
      {/* 1. Add / Edit Delivery Form */}
      <DeliveryForm
        vendors={vendors}
        editingDelivery={editingDelivery}
        onCancelEdit={() => setEditingDelivery(null)}
        onSaved={loadData}
      />

      {/* 2. Delivered Orders List for Selected Date */}
      <DeliveredOrdersList
        deliveries={deliveries}
        onEditDelivery={(d) => setEditingDelivery(d)}
        onDeliveryDeleted={loadData}
      />

      {/* 3. Add / Edit Expense Form */}
      <ExpenseForm
        editingExpense={editingExpense}
        onCancelEdit={() => setEditingExpense(null)}
        onSaved={loadData}
      />

      {/* 4. Expenses List for Selected Date */}
      <ExpensesList
        expenses={expenses}
        onEditExpense={(exp) => setEditingExpense(exp)}
        onExpenseDeleted={loadData}
      />
    </ScrollView>
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
});
