import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Card, Button, EmptyState } from '../common/UIComponents';
import { updateStockQuantity, deleteStockRow } from '../../database/stockRepo';
import { formatNaira } from '../../utils/currency';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function VendorStockAccordion({ stockData = { vendors: [], grandTotalValue: 0 }, onReload }) {
  const { theme } = useTheme();
  const { showAlert, showConfirm, showPrompt, showToast } = useAlert();

  // Accordion state: only one open at a time
  const [expandedVendorId, setExpandedVendorId] = useState(null);

  const toggleVendor = (vendorId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedVendorId((prev) => (prev === vendorId ? null : vendorId));
  };

  const handleCopyAll = async () => {
    // Filter vendors that actually have items
    const activeVendors = stockData.vendors.filter((v) => v.items && v.items.length > 0);
    if (activeVendors.length === 0) {
      await showAlert({ title: 'No Data', message: 'No inventory to copy.', variant: 'info' });
      return;
    }

    let text = '=== ALL INVENTORY BALANCES ===\n\n';
    activeVendors.forEach((vendor, index) => {
      text += `${vendor.vendor_name.toUpperCase()}\n`;
      vendor.items.forEach((it) => {
        text += `- ${it.item_name}: ${it.quantity}\n`;
      });
      if (index < activeVendors.length - 1) {
        text += '\n';
      }
    });

    await Clipboard.setStringAsync(text.trim());
    showToast('All Inventory Copied!');
  };

  const handleCopyVendor = async (vendor) => {
    if (!vendor.items || vendor.items.length === 0) {
      await showAlert({
        title: 'Empty Stock',
        message: `Vendor ${vendor.vendor_name} has no items in stock.`,
        variant: 'info',
      });
      return;
    }

    let text = `=== INVENTORY FOR ${vendor.vendor_name.toUpperCase()} ===\n\n`;
    vendor.items.forEach((it) => {
      text += `- ${it.item_name}: ${it.quantity}\n`;
    });

    await Clipboard.setStringAsync(text.trim());
    showToast(`Inventory for ${vendor.vendor_name} Copied!`);
  };

  const handleEditQuantity = async (item) => {
    const res = await showPrompt({
      title: `Update Stock: ${item.item_name}`,
      message: 'Enter new stock balance quantity:',
      initialValue: item.quantity.toString(),
      keyboardType: 'numeric',
      placeholder: '0',
      validate: (val) => {
        const num = parseInt(val, 10);
        if (isNaN(num) || num < 0) return 'Please enter a valid quantity >= 0';
        return null;
      },
    });

    if (res !== null) {
      try {
        await updateStockQuantity(item.stock_id, res);
        showToast(`Quantity updated for ${item.item_name}`);
        onReload();
      } catch (e) {
        showAlert({ title: 'Error', message: e.message, variant: 'error' });
      }
    }
  };

  const handleDeleteStockRow = async (item) => {
    const confirmed = await showConfirm({
      title: 'Remove Stock Row',
      message: `Remove "${item.item_name}" stock entry from this vendor?`,
      confirmText: 'Remove Stock',
      isDestructive: true,
    });

    if (confirmed) {
      try {
        await deleteStockRow(item.stock_id);
        showToast('Stock row removed.');
        onReload();
      } catch (e) {
        showAlert({ title: 'Error', message: e.message, variant: 'error' });
      }
    }
  };

  const vendors = stockData.vendors || [];

  return (
    <View style={styles.container}>
      {/* Top action row */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text }]}>Vendor Stock Balances</Text>
        <View style={styles.headerBtnGroup}>
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
            onPress={onReload}
          >
            <Ionicons name="refresh" size={16} color={theme.text} />
            <Text style={[styles.smallBtnText, { color: theme.text }]}>Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]}
            onPress={handleCopyAll}
          >
            <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
            <Text style={[styles.smallBtnText, { color: '#FFFFFF' }]}>Copy All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {vendors.length === 0 ? (
        <EmptyState icon="cube-outline" message="No stock balances found." />
      ) : (
        <View style={styles.accordionList}>
          {vendors.map((vendor) => {
            const isExpanded = expandedVendorId === vendor.vendor_id;
            return (
              <Card key={vendor.vendor_id} style={[styles.vendorCard, { padding: 0 }]}>
                {/* Accordion Header */}
                <TouchableOpacity
                  style={[
                    styles.cardHeader,
                    {
                      backgroundColor: isExpanded ? theme.surfaceAlt : theme.surface,
                      borderBottomColor: theme.border,
                      borderBottomWidth: isExpanded ? 1 : 0,
                    },
                  ]}
                  onPress={() => toggleVendor(vendor.vendor_id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, marginRight: SPACING.sm }}>
                    <Text style={[styles.vendorHeaderName, { color: theme.text }]}>
                      {vendor.vendor_name}
                    </Text>
                    <Text style={[styles.vendorValueText, { color: theme.primary }]}>
                      Total Value: {formatNaira(vendor.total_value)} ({vendor.items.length} items)
                    </Text>
                  </View>

                  <View style={styles.headerRightActions}>
                    <TouchableOpacity
                      style={[styles.copyVendorBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => handleCopyVendor(vendor)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="copy-outline" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.textSecondary}
                    />
                  </View>
                </TouchableOpacity>

                {/* Accordion Body */}
                {isExpanded && (
                  <View style={[styles.cardBody, { backgroundColor: theme.surface }]}>
                    {vendor.items.length === 0 ? (
                      <Text style={[styles.noItemsText, { color: theme.textMuted }]}>
                        No items currently stocked for this vendor.
                      </Text>
                    ) : (
                      vendor.items.map((it) => (
                        <View
                          key={it.stock_id}
                          style={[styles.stockItemRow, { borderBottomColor: theme.divider }]}
                        >
                          <View style={{ flex: 1, marginRight: SPACING.sm }}>
                            <Text style={[styles.stockItemName, { color: theme.text }]}>
                              {it.item_name}
                            </Text>
                            <Text style={[styles.stockDetails, { color: theme.textSecondary }]}>
                              Stock: <Text style={{ fontWeight: '700', color: theme.text }}>{it.quantity}</Text> | Value:{' '}
                              {formatNaira(it.total_value)} (@ {formatNaira(it.item_price)})
                            </Text>
                          </View>

                          <View style={styles.itemActionBtns}>
                            <TouchableOpacity
                              style={[styles.actionBtn, { borderColor: theme.border }]}
                              onPress={() => handleEditQuantity(it)}
                            >
                              <Ionicons name="pencil" size={15} color={theme.textSecondary} />
                              <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>
                                Qty
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.actionBtn, { borderColor: theme.dangerLight }]}
                              onPress={() => handleDeleteStockRow(it)}
                            >
                              <Ionicons name="trash-outline" size={15} color={theme.danger} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      {/* Grand Total Value Box */}
      <View style={[styles.grandTotalBox, { backgroundColor: theme.primaryLight, borderColor: theme.border }]}>
        <Text style={[styles.grandTotalLabel, { color: theme.primaryDark }]}>
          GRAND TOTAL INVENTORY VALUE:
        </Text>
        <Text style={[styles.grandTotalAmount, { color: theme.primary }]}>
          {formatNaira(stockData.grandTotalValue || 0)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerBtnGroup: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 4,
  },
  smallBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  accordionList: {
    gap: SPACING.sm,
  },
  vendorCard: {
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  vendorHeaderName: {
    fontSize: 16,
    fontWeight: '700',
  },
  vendorValueText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  copyVendorBtn: {
    padding: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  cardBody: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  noItemsText: {
    paddingVertical: SPACING.md,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  stockItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stockItemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  stockDetails: {
    fontSize: 12,
    marginTop: 3,
  },
  itemActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    gap: 2,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  grandTotalBox: {
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  grandTotalAmount: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
});
