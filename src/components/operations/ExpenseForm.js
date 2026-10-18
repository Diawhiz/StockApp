import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, Badge, InputField, Button } from '../common/UIComponents';
import { createExpense, updateExpense } from '../../database/expensesRepo';
import { parseNumber } from '../../utils/currency';
import { useDate } from '../../context/DateContext';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { SPACING } from '../../styles/theme';

export function ExpenseForm({
  editingExpense = null,
  onCancelEdit,
  onSaved,
}) {
  const { theme } = useTheme();
  const { selectedDate } = useDate();
  const { showAlert, showToast } = useAlert();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingExpense) {
      setDescription(editingExpense.description || '');
      setAmount(editingExpense.amount ? String(editingExpense.amount) : '');
    } else {
      setDescription('');
      setAmount('');
    }
  }, [editingExpense]);

  const handleSubmit = async () => {
    const desc = description.trim();
    if (!desc) {
      await showAlert({
        title: 'Validation Error',
        message: 'Expense description is required.',
        variant: 'warning',
      });
      return;
    }

    const parsedAmount = parseNumber(amount);
    if (parsedAmount <= 0) {
      await showAlert({
        title: 'Validation Error',
        message: 'Expense amount must be greater than zero.',
        variant: 'warning',
      });
      return;
    }

    try {
      setLoading(true);

      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          date: selectedDate,
          description: desc,
          amount: parsedAmount,
        });
        showToast('Expense updated successfully!');
        if (onCancelEdit) onCancelEdit();
      } else {
        await createExpense({
          date: selectedDate,
          description: desc,
          amount: parsedAmount,
        });
        showToast('Expense added successfully!');
        setDescription('');
        setAmount('');
      }

      onSaved();
    } catch (e) {
      showAlert({
        title: 'Error Saving Expense',
        message: e.message || 'An error occurred.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.badgeRow}>
        <Badge label="Cost" variant="danger" />
        <Text style={[styles.cardTitle, { color: theme.text }]}>
          {editingExpense ? 'Edit Expense' : 'Add Expense'}
        </Text>
      </View>

      <InputField
        label="Description"
        placeholder="e.g. Fuel for generator, Bike repair"
        value={description}
        onChangeText={setDescription}
      />

      <InputField
        label="Amount (₦)"
        placeholder="0"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        prefix="₦"
      />

      <View style={styles.actionButtonsRow}>
        {editingExpense && (
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onCancelEdit}
            style={{ flex: 1, marginRight: SPACING.sm }}
          />
        )}
        <Button
          title={editingExpense ? 'Update Expense' : 'Add Expense'}
          icon={editingExpense ? 'save' : 'add-circle'}
          onPress={handleSubmit}
          loading={loading}
          style={{ flex: editingExpense ? 2 : 1 }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
  },
});
