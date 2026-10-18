import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, InputField, Button } from '../common/UIComponents';
import { SearchableSelect } from '../common/SearchableSelect';
import { assignOrAddStock } from '../../database/stockRepo';
import { formatNaira } from '../../utils/currency';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { SPACING } from '../../styles/theme';

export function QuickAssignStock({ vendors = [], items = [], onStockAssigned }) {
  const { theme } = useTheme();
  const { showAlert, showToast } = useAlert();

  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);

  const vendorOptions = vendors.map((v) => ({
    label: v.name,
    value: v.id,
  }));

  const itemOptions = items.map((it) => ({
    label: `${it.name} (${formatNaira(it.price)})`,
    value: it.id,
    subtitle: `Unit Price: ${formatNaira(it.price)}`,
  }));

  const handleAssign = async () => {
    if (!selectedVendorId) {
      await showAlert({ title: 'Validation Error', message: 'Please select a vendor.', variant: 'warning' });
      return;
    }
    if (!selectedItemId) {
      await showAlert({ title: 'Validation Error', message: 'Please select an item.', variant: 'warning' });
      return;
    }
    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      await showAlert({
        title: 'Validation Error',
        message: 'Please enter a valid nonzero quantity.',
        variant: 'warning',
      });
      return;
    }

    try {
      setLoading(true);
      await assignOrAddStock(selectedVendorId, selectedItemId, parsedQty);
      setQuantity('');
      showToast('Stock assigned successfully!');
      onStockAssigned();
    } catch (e) {
      showAlert({ title: 'Error', message: e.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Assign Stock</Text>

      <SearchableSelect
        label="Select Vendor"
        placeholder="Choose vendor..."
        options={vendorOptions}
        selectedValue={selectedVendorId}
        onSelect={(val) => setSelectedVendorId(val)}
      />

      <SearchableSelect
        label="Select Product Item"
        placeholder="Choose item..."
        options={itemOptions}
        selectedValue={selectedItemId}
        onSelect={(val) => setSelectedItemId(val)}
      />

      <InputField
        label="Stock Quantity to Add"
        placeholder="e.g. 20"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
      />

      <Button
        title="Assign Stock"
        icon="cube"
        onPress={handleAssign}
        loading={loading}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
});
