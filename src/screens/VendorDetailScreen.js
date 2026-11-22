import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAlert } from '../context/AlertContext';
import { useTheme } from '../context/ThemeContext';
import { SPACING, RADIUS } from '../styles/theme';
import { formatNaira } from '../utils/currency';
import { buildVendorStockText } from '../utils/stockCopy';

// Helper: format number to Naira
const formatNaira = (num) => {
  if (num === undefined || num === null) return '0';
  return Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function VendorDetailScreen({ route, navigation }) {
  const { vendorId } = route.params;
  const { theme } = useTheme();
  const { showAlert, showToast } = useAlert();

  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      // Import here to avoid circular deps
      const { getVendorWithItems } = await import('../database/vendorsRepo');
      const data = await getVendorWithItems(vendorId);
      setVendor(data);
    } catch (e) {
      console.error('Failed to load vendor', e);
      showAlert({ title: 'Error', message: e.message, variant: 'error' });
    } finally {
      setLoading(false);
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

  if (loading) {
    return <Text>Loading vendor...</Text>;
  }

  if (!vendor) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.background }]}> 
        <Text style={{ color: theme.text }}>Vendor not found.</Text>
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
    <View style={styles.screen}>
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
        </View>
      </View>

      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => { load(); }}
            tintColor={theme.primary}
          />
        }
      >
        {/* Vendor identity */}
        <Text style={[styles.vendorName, { color: theme.text }]}>{vendor.name}</Text>

        <View style={[styles.statsRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.statValue, { color: theme.text }]}>Items</Text>
          <Text style={[styles.statValue, { color: theme.primary }]}>{vendor.items.length}</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>Expected</Text>
          <Text style={[styles.statValue, { color: theme.primary }]}>{totalExpected}</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>Actual</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>{totalActual}</Text>
          <Text style={[styles.statValue, { color: totalMissing > 0 ? theme.danger : theme.success }]}>Missing</Text>
          <Text style={[styles.statValue, { color: theme.textSecondary }]}>Value</Text>
          <Text style={{ fontWeight: '700', color: theme.text }}>{formatNaira(totalValue)}</Text>
        </View>

        {/* Products list - read-only display */}
        <Text style={[styles.listTitle, { color: theme.textSecondary }]}>Products ({vendor.items.length})</Text>

        {vendor.items.length === 0 ? (
          <Text style={{ color: theme.textMuted, fontStyle: 'italic', padding: 20 }}>
            No products yet.
          </Text>
        ) : (
          <View style={{ backgroundColor: theme.surface, borderRadius: 8, padding: 12 }}>
            <View style={styles.tableHeader}>
              <Text style={[styles.thText, { flex: 2.2, color: theme.textMuted }]}>Item</Text>
              <Text style={[styles.thText, { flex: 0.8, textAlign: 'center', color: theme.textMuted }]}>Exp</Text>
              <Text style={[styles.thText, { flex: 0.8, textAlign: 'center', color: theme.textMuted }]}>Act</Text>
              <Text style={[styles.thText, { flex: 0.8, textAlign: 'center', color: theme.textMuted }]}>Miss</Text>
              <Text style={[styles.thText, { flex: 1.3, textAlign: 'right', color: theme.textMuted }]}>Price</Text>
            </View>

            {vendor.items.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.itemNameText, { color: theme.text, flex: 2.2 }]} numberOfLines={2}>
                  {item.name}
                </Text>

                <View style={[styles.cellWrapper, { flex: 0.8, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <Text style={[styles.cellInput, { color: theme.text, textAlign: 'center' }]}> 
                    {item.expected}
                  </Text>
                </View>

                <View style={[styles.cellWrapper, { flex: 0.8, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <Text style={[styles.cellInput, { color: theme.text, textAlign: 'center' }]}> 
                    {item.actual}
                  </Text>
                </View>

                <View style={[
                  styles.missBadge, 
                  { backgroundColor: item.missing > 0 ? theme.dangerLight : theme.successLight }
                ]}>
                  <Text style={[styles.missText, { color: item.missing > 0 ? theme.danger : theme.success }]}>
                    {item.missing}
                  </Text>
                </View>

                <Text style={[styles.priceText, { color: theme.primary, flex: 1.3, textAlign: 'right' }]}>
                  {formatNaira(item.price)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, color, theme }) {
  return (
    <View style={styles.stat}>
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
  backLink: {
    alignItems: 'center',
    padding: SPACING.md,
  },
});