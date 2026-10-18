import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState } from '../common/UIComponents';
import { deleteExpense } from '../../database/expensesRepo';
import { formatNaira } from '../../utils/currency';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

export function ExpensesList({
  expenses = [],
  onEditExpense,
  onExpenseDeleted,
}) {
  const { theme } = useTheme();
  const { showConfirm, showToast, showAlert } = useAlert();

  const handleDelete = async (expense) => {
    const confirmed = await showConfirm({
      title: 'Delete Expense',
      message: `Delete expense "${expense.description}" of ${formatNaira(expense.amount)}?`,
      confirmText: 'Delete Expense',
      isDestructive: true,
    });

    if (confirmed) {
      try {
        await deleteExpense(expense.id);
        showToast('Expense removed.');
        onExpenseDeleted();
      } catch (e) {
        showAlert({ title: 'Error', message: e.message, variant: 'error' });
      }
    }
  };

  if (expenses.length === 0) {
    return (
      <Card>
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Recorded Expenses</Text>
        <EmptyState icon="receipt-outline" message="No expenses for this date." />
      </Card>
    );
  }

  const totalExpense = expenses.reduce((acc, exp) => acc + (exp.amount || 0), 0);

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionHeading, { color: theme.text }]}>
          Recorded Expenses ({expenses.length})
        </Text>
        <Text style={[styles.totalAmount, { color: theme.danger }]}>
          Total: {formatNaira(totalExpense)}
        </Text>
      </View>

      <View style={styles.list}>
        {expenses.map((exp) => (
          <View
            key={exp.id}
            style={[
              styles.expenseRow,
              { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
            ]}
          >
            <View style={{ flex: 1, marginRight: SPACING.sm }}>
              <Text style={[styles.descText, { color: theme.text }]}>
                {exp.description}:{' '}
                <Text style={{ fontWeight: '700', color: theme.danger }}>
                  {formatNaira(exp.amount)}
                </Text>
              </Text>
            </View>

            <View style={styles.actionBtns}>
              <TouchableOpacity
                style={[styles.btn, { borderColor: theme.border }]}
                onPress={() => onEditExpense(exp)}
              >
                <Ionicons name="pencil" size={15} color={theme.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, { borderColor: theme.dangerLight }]}
                onPress={() => handleDelete(exp)}
              >
                <Ionicons name="trash-outline" size={15} color={theme.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    gap: SPACING.xs,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  descText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  btn: {
    padding: 7,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
});
