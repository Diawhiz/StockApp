import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Card, EmptyState, LoadingSpinner } from '../components/common/UIComponents';
import {
  getVendorWithItems,
  deleteVendor,
  addVendorItem,
  updateVendorItem,
  deleteVendorItem,
} from '../database/vendorsRepo';
import { formatNaira, parseNumber } from '../utils/currency';
import { buildVendorStockText } from '../utils/stockCopy';
import { useAlert } from '../context/AlertContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../styles/theme';

export function VendorDetailScreen({ route, navigation }) {
  const { vendorId } = route.params;
  const { theme } = useTheme();
  const { showAlert, showConfirm, showPrompt, showToast } = useAlert();

  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ name: '', exp: '', act: '', price: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getVendorWithItems(vendorId);
      setVendor(data);
    } catch (e) {
      console.error('Failed to load vendor', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCopyStock = async () => {
    if (!vendor || !vendor.items.length) {
      await showAlert({
        title: 'Empty Stock',
        message: `Vendor ${vendor?.name} has no items in stock.`,
        variant: 'info',
      });
      return;
    }
    await Clipboard.setStringAsync(buildVendorStockText(vendor).trim());
    showToast(`Stock for ${vendor.name} Copied!`);
  };

  const handleDeleteVendor = async () => {
    const confirmed = await showConfirm({
      title: 'Delete Vendor',
      message: `Are you sure you want to delete "${vendor.name}" and all its inventory items? This cannot be undone.`,
      confirmText: 'Delete Vendor',
      isDestructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteVendor(vendor.id);
      showToast(`Vendor "${vendor.name}" deleted.`);
      navigation.goBack();
    } catch (e) {
      showAlert({ title: 'Error', message: e.message, variant: 'error' });
    }
  };

  const handleAddItem = async () => {
    const trimmed = form.name.trim();
    if (!trimmed) {
      await showAlert({ title: 'Validation Error', message: 'Item name is required.', variant: 'warning' });
      return;
    }
    try {
      setAdding(true);
      await addVendorItem(vendorId, {
        name: trimmed,
        price: parseNumber(form.price),
        expected: parseInt(form.exp, 10) || 0,
        actual: parseInt(form.act, 10) || 0,
      });
      setForm({ name: '', exp: '', act: '', price: '' });
      showToast(`Item "${trimmed}" added!`);
      load();
    } catch (e) {
      showAlert({ title: 'Error', message: e.message, variant: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleInlineItemUpdate = async (itemId, field, text) => {
    try {
      if (field === 'expected' || field === 'actual') {
        await updateVendorItem(itemId, { [field]: parseInt(text, 10) || 0 });
      } else if (field === 'price') {
        await updateVendorItem(itemId, { price: parseNumber(text) });
      }
      load();
    } catch (e) {
      console.error('Failed to update item cell', e);
    }
  };

  const handleDeleteItem = async (item) => {
    const confirmed = await showConfirm({
      title: 'Delete Item',
      message: `Delete "${item.name}" from vendor stock?`,
      confirmText: 'Delete Item',
      isDestructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteVendorItem(item.id);
      showToast(`Item "${item.name}" removed.`);
      load();
    } catch (e) {
      showAlert({ title: 'Error', message: e.message, variant: 'error' });
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading vendor..." />;
  }

  if (!vendor) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <EmptyState icon="help-circle-outline" message="Vendor not found." />
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={{ color: theme.primary, fontWeight: '700' }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalExpected = vendor.items.reduce((acc, it) => acc + (it.expected || 0), 0);
  const totalActual = vendor.items.reduce((acc, it) => acc + (it.actual || 0), 0);
  const totalMissing = totalExpected - totalActual;
  const totalValue = vendor.items.reduce((acc, it) => acc + (it.price || 0) * (it.actual || 0), 0);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={20} color={theme.text} />
          <Text style={[styles.backBtnText, { color: theme.text }]}>Inventory</Text>
        </TouchableOpacity>
        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={[styles.topActionBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
            onPress={handleCopyStock}
            activeOpacity={0.7}
          >
            <Ionicons name="copy-outline" size={16} color={theme.textSecondary} />
            <Text style={[styles.topActionText, { color: theme.textSecondary }]}>Copy Stock</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.topActionBtn, { borderColor: theme.dangerLight, backgroundColor: theme.dangerLight }]}
            onPress={handleDeleteVendor}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} />
        }
      >
        {/* Vendor identity */}
        <Text style={[styles.vendorName, { color: theme.text }]}>{vendor.name}</Text>
        <View style={[styles.statsRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Stat label="Items" value={String(vendor.items.length)} color={theme.text} theme={theme} />
          <Stat label="Expected" value={String(totalExpected)} color={theme.primary} theme={theme} />
          <Stat label="Actual" value={String(totalActual)} color={theme.text} theme={theme} />
          <Stat
            label="Missing"
            value={String(totalMissing)}
            color={totalMissing > 0 ? theme.danger : theme.success}
            theme={theme}
            last
          />
        </View>
        <Text style={[styles.valueText, { color: theme.textSecondary }]}>
          Stock value: <Text style={{ fontWeight: '700', color: theme.text }}>{formatNaira(totalValue)}</Text>
        </Text>

        {/* Add product */}
        <Card style={[styles.addCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Add Product</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
            placeholder="Product name"
            placeholderTextColor={theme.textMuted}
            value={form.name}
            onChangeText={(txt) => setForm((p) => ({ ...p, name: txt }))}
          />
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputFlex, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Expected"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={form.exp}
              onChangeText={(txt) => setForm((p) => ({ ...p, exp: txt }))}
            />
            <TextInput
              style={[styles.input, styles.inputFlex, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="Actual"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={form.act}
              onChangeText={(txt) => setForm((p) => ({ ...p, act: txt }))}
            />
            <TextInput
              style={[styles.input, styles.inputFlex, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
              placeholder="₦ Price"
              placeholderTextColor={theme.textMuted}
              keyboardType="numeric"
              value={form.price}
              onChangeText={(txt) => setForm((p) => ({ ...p, price: txt }))}
            />
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.primary, opacity: adding ? 0.6 : 1 }]}
            onPress={handleAddItem}
            disabled={adding}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add to Stock</Text>
          </TouchableOpacity>
        </Card>

        {/* Products */}
        <Text style={[styles.listTitle, { color: theme.textSecondary }]}>
          Products ({vendor.items.length})
        </Text>

        {vendor.items.length === 0 ? (
          <EmptyState icon="cube-outline" message="No products yet. Add the first one above." />
        ) : (
          <Card style={{ padding: 0, backgroundColor: theme.surface }}>
            <View style={[styles.tableHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.thText, { flex: 2.2, color: theme.textMuted }]}>Item</Text>
              <Text style={[styles.thText, { flex: 0.9, textAlign: 'center', color: theme.textMuted }]}>Exp</Text>
              <Text style={[styles.thText, { flex: 0.9, textAlign: 'center', color: theme.textMuted }]}>Act</Text>
              <Text style={[styles.thText, { flex: 0.9, textAlign: 'center', color: theme.textMuted }]}>Miss</Text>
              <Text style={[styles.thText, { flex: 1.2, textAlign: 'right', color: theme.textMuted }]}>Price</Text>
              <View style={{ width: 28 }} />
            </View>

            {vendor.items.map((item) => (
              <View key={item.id} style={[styles.tableRow, { borderBottomColor: theme.divider }]}>
                <TouchableOpacity
                  style={{ flex: 2.2, paddingRight: 6 }}
                  onPress={async () => {
                    const newName = await showPrompt({
                      title: `Rename: ${item.name}`,
                      message: 'Enter new product name:',
                      initialValue: item.name,
                    });
                    if (newName !== null && newName.trim()) {
                      await updateVendorItem(item.id, { name: newName.trim() });
                      load();
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.itemNameText, { color: theme.text }]} numberOfLines={2}>
                    {item.name}
                  </Text>
                </TouchableOpacity>

                <View style={[styles.cellWrapper, { flex: 0.9, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.cellInput, { color: theme.text }]}
                    keyboardType="numeric"
                    defaultValue={String(item.expected)}
                    onEndEditing={(e) => handleInlineItemUpdate(item.id, 'expected', e.nativeEvent.text)}
                  />
                </View>

                <View style={[styles.cellWrapper, { flex: 0.9, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.cellInput, { color: theme.text }]}
                    keyboardType="numeric"
                    defaultValue={String(item.actual)}
                    onEndEditing={(e) => handleInlineItemUpdate(item.id, 'actual', e.nativeEvent.text)}
                  />
                </View>

                <View
                  style={[
                    styles.missBadge,
                    { flex: 0.9, backgroundColor: item.missing > 0 ? theme.dangerLight : theme.successLight },
                  ]}
                >
                  <Text style={[styles.missText, { color: item.missing > 0 ? theme.danger : theme.success }]}>
                    {item.missing}
                  </Text>
                </View>

                <TouchableOpacity
                  style={{ flex: 1.2, alignItems: 'flex-end', justifyContent: 'center' }}
                  onPress={async () => {
                    const newP = await showPrompt({
                      title: `Edit Price: ${item.name}`,
                      message: 'Enter unit price in ₦:',
                      initialValue: String(item.price),
                      keyboardType: 'numeric',
                    });
                    if (newP !== null) {
                      handleInlineItemUpdate(item.id, 'price', newP);
                    }
                  }}
                >
                  <Text style={[styles.priceText, { color: theme.primary }]}>{formatNaira(item.price)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteItemBtn}
                  onPress={() => handleDeleteItem(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stat({ label, value, color, theme, last }) {
  return (
    <View style={[styles.stat, !last && { borderRightWidth: 1, borderRightColor: theme.divider }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 2,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  topActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 4,
  },
  topActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl * 2,
  },
  vendorName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: SPACING.md,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  stat: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  valueText: {
    fontSize: 13,
    marginBottom: SPACING.lg,
  },
  addCard: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
    marginBottom: SPACING.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  inputFlex: {
    flex: 1,
    minWidth: 0,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: RADIUS.md,
    gap: 6,
    marginTop: SPACING.xs,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    paddingVertical: SPACING.sm,
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemNameText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cellWrapper: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    marginHorizontal: 2,
    height: 32,
    justifyContent: 'center',
    minWidth: 0,
  },
  cellInput: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    padding: 0,
  },
  missBadge: {
    borderRadius: RADIUS.sm,
    height: 28,
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missText: {
    fontSize: 13,
    fontWeight: '800',
  },
  priceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deleteItemBtn: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLink: {
    alignItems: 'center',
    padding: SPACING.md,
  },
});
