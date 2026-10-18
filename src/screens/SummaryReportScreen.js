import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { ReconciliationCard } from '../components/reports/ReconciliationCard';
import { ReportView } from '../components/reports/ReportView';
import { LoadingSpinner } from '../components/common/UIComponents';
import { getDeliveriesByDate } from '../database/deliveriesRepo';
import { getExpensesByDate } from '../database/expensesRepo';
import { useDate } from '../context/DateContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../styles/theme';

export function SummaryReportScreen() {
  const { theme } = useTheme();
  const { selectedDate } = useDate();

  const [deliveries, setDeliveries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dels, exps] = await Promise.all([
        getDeliveriesByDate(selectedDate),
        getExpensesByDate(selectedDate),
      ]);
      setDeliveries(dels);
      setExpenses(exps);
    } catch (e) {
      console.error('Failed to load summary data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [selectedDate, loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalSales = deliveries.reduce((acc, d) => acc + (d.price || 0), 0);
  const totalExpenses = expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);

  if (loading) {
    return <LoadingSpinner text="Generating reconciliation summary..." />;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
    >
      <ReconciliationCard totalSales={totalSales} totalExpenses={totalExpenses} />
      <ReportView date={selectedDate} deliveries={deliveries} expenses={expenses} />
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
