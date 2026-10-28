import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, InputField, Button } from '../common/UIComponents';
import { SearchableSelect } from '../common/SearchableSelect';
import { DeliveryItemRow } from './DeliveryItemRow';
import { createDelivery, updateDelivery, getRecentRiders } from '../../database/deliveriesRepo';
import {
  applyStickyRiderAfterSave,
  clearStickyRider,
  getStickyRider,
} from '../../utils/riderPrefs';
import { useDate } from '../../context/DateContext';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

export function DeliveryForm({
  vendors = [],
  editingDelivery = null,
  onCancelEdit,
  onSaved,
}) {
  const { theme } = useTheme();
  const { selectedDate } = useDate();
  const { showAlert, showToast } = useAlert();

  const [location, setLocation] = useState('');
  const [rider, setRider] = useState('');
  const [manualRider, setManualRider] = useState(false);
  const [recentRiders, setRecentRiders] = useState([]);
  const [sticky, setSticky] = useState(null);
  const [product, setProduct] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('');
  const [itemRows, setItemRows] = useState([]);
  const [priceOverridden, setPriceOverridden] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadRiderPrefs = useCallback(async () => {
    try {
      const [riders, stickyRider] = await Promise.all([getRecentRiders(), getStickyRider()]);
      setRecentRiders(riders);
      setSticky(stickyRider);
    } catch (e) {
      console.error('Failed to load rider preferences', e);
    }
  }, []);

  useEffect(() => {
    loadRiderPrefs();
  }, [loadRiderPrefs]);

  // Prefill the sticky rider on a fresh (non-edit) form
  useEffect(() => {
    if (!editingDelivery && sticky && !rider) {
      setRider(sticky.name);
    }
  }, [sticky, editingDelivery, rider]);

  // When editingDelivery changes, populate form
  useEffect(() => {
    if (editingDelivery) {
      setLocation(editingDelivery.location || '');
      setRider(editingDelivery.rider || '');
      setProduct(editingDelivery.product || '');
      setPrice(editingDelivery.price ? String(editingDelivery.price) : '');
      setFee(editingDelivery.fee ? String(editingDelivery.fee) : '');
      
      const rows = (editingDelivery.items || []).map((it) => ({
        vendor_id: it.vendor_id || '',
        vendor_name: it.vendor_name_snapshot || '',
        item_id: it.item_id || '',
        item_name: it.item_name_snapshot || '',
        unit_price: it.unit_price_snapshot || 0,
        quantity: it.quantity || 1,
      }));
      setItemRows(rows);
      setPriceOverridden(true);
    } else {
      resetForm();
    }
  }, [editingDelivery]);

  const resetForm = () => {
    setLocation('');
    setProduct('');
    setPrice('');
    setFee('');
    setItemRows([]);
    setPriceOverridden(false);
    setManualRider(false);
    // Rider intentionally persists: sticky rider prefills the next orders
  };

  // Recalculate auto-filled Product and Price when itemRows change
  useEffect(() => {
    // If we're not currently editing an existing delivery that loaded its own state
    const namedItems = itemRows.filter((r) => r.item_name && r.item_name.trim().length > 0);

    if (namedItems.length > 0) {
      // Auto-fill Product / Details with joined item names
      const joinedNames = namedItems.map((r) => r.item_name).join(', ');
      setProduct(joinedNames);

      // Auto-fill Price only if not manually overridden
      if (!priceOverridden) {
        const calculatedPrice = namedItems.reduce((acc, r) => {
          const qty = parseInt(r.quantity, 10) || 1;
          return acc + (r.unit_price || 0) * qty;
        }, 0);
        setPrice(calculatedPrice > 0 ? String(calculatedPrice) : '');
      }
    } else if (itemRows.length === 0 && !editingDelivery) {
      // When no item rows are selected, show Product field again and clear Price
      if (!priceOverridden) {
        setPrice('');
      }
    }
  }, [itemRows, priceOverridden, editingDelivery]);

  const handleAddRow = () => {
    setItemRows((prev) => [
      ...prev,
      { vendor_id: '', vendor_name: '', item_id: '', item_name: '', unit_price: 0, quantity: '1' },
    ]);
  };

  const handleRowChange = (index, updatedRow) => {
    setItemRows((prev) => {
      const next = [...prev];
      next[index] = updatedRow;
      return next;
    });
  };

  const handleRemoveRow = (index) => {
    setItemRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setPriceOverridden(false);
      }
      return next;
    });
  };

  const handlePriceChange = (val) => {
    setPrice(val);
    setPriceOverridden(true);
  };

  const handleSubmit = async () => {
    const loc = location.trim();
    const rid = rider.trim();
    const prod = product.trim();

    if (!loc || !rid || !prod) {
      await showAlert({
        title: 'Validation Error',
        message: 'Location, Rider, and Product / Details are required fields.',
        variant: 'warning',
      });
      return;
    }

    try {
      setLoading(true);

      const payload = {
        date: selectedDate,
        location: loc,
        rider: rid,
        product: prod,
        price,
        fee,
        items: itemRows,
      };

      if (editingDelivery) {
        await updateDelivery(editingDelivery.id, payload);
        showToast('Delivery updated successfully!');
        if (onCancelEdit) onCancelEdit();
      } else {
        await createDelivery(payload);
        const nextSticky = await applyStickyRiderAfterSave(rid);
        setSticky(nextSticky);
        await loadRiderPrefs();
        showToast('Delivery added successfully!');
        resetForm();
      }

      onSaved();
    } catch (e) {
      showAlert({
        title: 'Error Saving Delivery',
        message: e.message || 'An unexpected error occurred.',
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const hasItemRows = itemRows.length > 0;

  const riderOptions = (() => {
    const seen = new Set();
    const opts = [];
    const push = (name, subtitle) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return;
      seen.add(key);
      opts.push({ label: name, value: name, subtitle });
    };
    if (sticky) push(sticky.name, `Active · auto-fills the next ${sticky.remaining} orders`);
    recentRiders.forEach((name) => push(name));
    if (rider && !seen.has(rider.toLowerCase())) push(rider);
    return opts;
  })();

  const handleForgetRider = async () => {
    await clearStickyRider();
    setSticky(null);
    setRider('');
  };

  return (
    <Card style={styles.card}>
      {/* Card title */}
      <Text style={[styles.cardTitle, { color: theme.text }]}>
        {editingDelivery ? 'Edit Delivery' : 'Add Delivery'}
      </Text>

      <InputField
        label="Location"
        placeholder="e.g. Lekki Phase 1, Lagos"
        value={location}
        onChangeText={setLocation}
      />

      {manualRider ? (
        <View style={styles.riderRow}>
          <InputField
            label="Rider"
            placeholder="e.g. John Doe"
            value={rider}
            onChangeText={setRider}
            style={{ flex: 1, marginBottom: 0 }}
          />
          <TouchableOpacity
            style={[styles.riderToggleBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
            onPress={() => setManualRider(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="list-outline" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View>
          <SearchableSelect
            label="Rider"
            placeholder="Select rider..."
            options={riderOptions}
            selectedValue={rider}
            onSelect={(value) => setRider(value)}
            onOtherPress={() => setManualRider(true)}
            onClear={() => setRider('')}
          />
          {sticky && sticky.name === rider && !editingDelivery ? (
            <View style={styles.stickyHintRow}>
              <Text style={[styles.stickyHint, { color: theme.textMuted }]}>
                Auto-filled for the next {sticky.remaining} {sticky.remaining === 1 ? 'order' : 'orders'}
              </Text>
              <TouchableOpacity onPress={handleForgetRider} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={[styles.stickyForget, { color: theme.primary }]}>Forget</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {/* Product field is hidden when item rows are active */}
      {!hasItemRows ? (
        <InputField
          label="Product / Details"
          placeholder="e.g. Leather Bag & Wallet"
          value={product}
          onChangeText={setProduct}
          multiline
        />
      ) : (
        <View style={[styles.autoProductBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Text style={[styles.autoProductLabel, { color: theme.textMuted }]}>
            Product details
          </Text>
          <Text style={[styles.autoProductText, { color: theme.text }]}>{product || 'Select items below'}</Text>
        </View>
      )}

      {/* Order Items Section */}
      <View style={[styles.itemsSection, { borderColor: theme.border }]}>
        <View style={styles.itemsSectionHeader}>
          <Text style={[styles.itemsSectionTitle, { color: theme.textSecondary }]}>
            Order items · optional stock deduction
          </Text>
          <TouchableOpacity
            style={[styles.addInventoryBtn, { backgroundColor: theme.primaryLight }]}
            onPress={handleAddRow}
          >
            <Text style={[styles.addInventoryBtnText, { color: theme.primary }]}>
              + Add product
            </Text>
          </TouchableOpacity>
        </View>

        {itemRows.map((row, index) => (
          <DeliveryItemRow
            key={index}
            index={index}
            row={row}
            vendors={vendors}
            onChangeRow={handleRowChange}
            onRemoveRow={handleRemoveRow}
          />
        ))}
      </View>

      <View style={styles.financeRow}>
        <InputField
          label="Price (₦)"
          placeholder="0"
          value={price}
          onChangeText={handlePriceChange}
          keyboardType="numeric"
          prefix="₦"
          style={{ flex: 1, marginRight: SPACING.sm }}
        />
        <InputField
          label="Delivery Fee (₦)"
          placeholder="0"
          value={fee}
          onChangeText={setFee}
          keyboardType="numeric"
          prefix="₦"
          style={{ flex: 1 }}
        />
      </View>

      <View style={styles.actionButtonsRow}>
        {editingDelivery && (
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onCancelEdit}
            style={{ flex: 1, marginRight: SPACING.sm }}
          />
        )}
        <Button
          title={editingDelivery ? 'Update Detail' : 'Add Delivery'}
          icon={editingDelivery ? 'save' : 'add-circle'}
          onPress={handleSubmit}
          loading={loading}
          style={{ flex: editingDelivery ? 2 : 1 }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACING.lg,
  },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  riderToggleBtn: {
    height: 46,
    width: 46,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  stickyHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -6,
    marginBottom: SPACING.md,
    paddingHorizontal: 2,
  },
  stickyHint: {
    fontSize: 12,
  },
  stickyForget: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  autoProductBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  autoProductLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  autoProductText: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemsSection: {
    borderTopWidth: 1,
    paddingTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  itemsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  itemsSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  addInventoryBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
  },
  addInventoryBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  financeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: SPACING.xs,
  },
});
