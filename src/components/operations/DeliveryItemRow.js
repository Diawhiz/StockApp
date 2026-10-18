import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchableSelect } from '../common/SearchableSelect';
import { InputField } from '../common/UIComponents';
import { getInStockItemsForVendor } from '../../database/vendorsRepo';
import { formatNaira } from '../../utils/currency';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

export function DeliveryItemRow({
  row,
  index,
  vendors = [],
  onChangeRow,
  onRemoveRow,
}) {
  const { theme } = useTheme();
  const [vendorItems, setVendorItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Load items in stock whenever vendor changes
  useEffect(() => {
    let active = true;
    async function loadStock() {
      if (!row.vendor_id) {
        setVendorItems([]);
        return;
      }
      try {
        setLoadingItems(true);
        const stockList = await getInStockItemsForVendor(row.vendor_id);
        if (active) {
          setVendorItems(stockList);
        }
      } catch (e) {
        console.error('Failed to load stock for vendor', e);
      } finally {
        if (active) setLoadingItems(false);
      }
    }
    loadStock();
    return () => {
      active = false;
    };
  }, [row.vendor_id]);

  const vendorOptions = vendors.map((v) => ({
    label: v.name,
    value: v.id,
  }));

  const itemOptions = vendorItems.map((it) => ({
    label: `${it.name} (Qty: ${it.actual})`,
    value: it.id,
    subtitle: `Price: ${formatNaira(it.price)} | Act: ${it.actual}, Exp: ${it.expected}`,
    rawItem: it,
  }));

  const handleVendorSelect = (vendorId, option) => {
    onChangeRow(index, {
      ...row,
      vendor_id: vendorId,
      vendor_name: option.label,
      item_id: '',
      item_name: '',
      unit_price: 0,
    });
  };

  const handleItemSelect = (itemId, option) => {
    const raw = option.rawItem;
    onChangeRow(index, {
      ...row,
      item_id: itemId,
      item_name: raw.name,
      unit_price: raw.price || 0,
      quantity: row.quantity || '1',
    });
  };

  const handleQuantityChange = (qty) => {
    onChangeRow(index, {
      ...row,
      quantity: qty,
    });
  };

  return (
    <View style={[styles.rowContainer, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <Text style={[styles.rowNumber, { color: theme.textSecondary }]}>Item #{index + 1}</Text>
        <TouchableOpacity
          onPress={() => onRemoveRow(index)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={20} color={theme.danger} />
        </TouchableOpacity>
      </View>

      <SearchableSelect
        placeholder="Select vendor..."
        options={vendorOptions}
        selectedValue={row.vendor_id}
        onSelect={handleVendorSelect}
        style={{ marginBottom: SPACING.sm }}
      />

      <SearchableSelect
        placeholder={
          !row.vendor_id
            ? 'Select vendor first'
            : loadingItems
            ? 'Loading in-stock items...'
            : vendorItems.length === 0
            ? 'No items with actual stock > 0'
            : 'Select in-stock item...'
        }
        disabled={!row.vendor_id || vendorItems.length === 0 || loadingItems}
        options={itemOptions}
        selectedValue={row.item_id}
        onSelect={handleItemSelect}
        style={{ marginBottom: SPACING.sm }}
      />

      <View style={styles.qtyRow}>
        <InputField
          label="Quantity"
          placeholder="1"
          value={row.quantity ? String(row.quantity) : ''}
          onChangeText={handleQuantityChange}
          keyboardType="numeric"
          style={{ flex: 1, marginBottom: 0 }}
        />
        {row.unit_price ? (
          <View style={styles.priceTag}>
            <Text style={[styles.priceTagLabel, { color: theme.textMuted }]}>Subtotal:</Text>
            <Text style={[styles.priceTagValue, { color: theme.primary }]}>
              {formatNaira((row.unit_price || 0) * (parseInt(row.quantity, 10) || 1))}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  rowNumber: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  priceTag: {
    alignItems: 'flex-end',
    paddingBottom: 8,
    marginLeft: SPACING.md,
  },
  priceTagLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  priceTagValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
