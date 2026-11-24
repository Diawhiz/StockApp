import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, RefreshControl, Text, View, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LoadingSpinner } from '../components/common/UIComponents';
import { OriginalInventoryManager } from '../components/inventory/OriginalInventoryManager';
import { getAllVendorsWithItems } from '../database/vendorsRepo';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../styles/theme';
import * as FileSystem from 'expo-file-system';
import { shareAsync } from 'expo-sharing';

// Helper: format number to Naira
const formatNaira = (num) => {
  if (num === undefined || num === null) return '0';
  return Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function InventoryScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const firstLoadDone = useRef(false);

  const loadVendors = useCallback(async () => {
    try {
      const data = await getAllVendorsWithItems();
      setVendors(data);
    } catch (e) {
      console.error('Failed to load vendors', e);
      Alert.alert('Error', 'Failed to load inventory. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      firstLoadDone.current = true;
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  // Refetch after returning from a vendor detail screen
  useFocusEffect(
    useCallback(() => {
      if (firstLoadDone.current) loadVendors();
    }, [loadVendors])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadVendors();
  };

  // Handle Excel export (download template only - no import since app is read-only)
  const handleExportExcel = async () => {
    try {
      // Generate CSV-style text from current vendors
      let csv = 'Vendor,Item,Quantity,Price (NGN)\n';
      
      const activeVendors = vendors.filter(v => v.items && v.items.length > 0);
      
      for (const vendor of activeVendors) {
        for (const item of vendor.items) {
          const totalValue = (item.price || 0) * (item.actual || 0);
          csv += `${vendor.name},${item.name},${item.actual},${formatNaira(totalValue)}\n`;
        }
      }
      
      const fileUri = `${FileSystem.documentDirectory}inventory_export_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'UTF-8' });
      
      // Share the file
      await shareAsync(fileUri);
      Alert.alert('Export Complete', 'Inventory exported as CSV and shared successfully.');
    } catch (err) {
      console.error('Export error:', err);
      Alert.alert('Export Failed', err.message || 'Could not export inventory.');
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading inventory and stock balances..." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        style={[{ flex: 1, backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerBar}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Inventory</Text>
          <TouchableOpacity
            style={[styles.exportBtn, { backgroundColor: theme.primary }]}
            onPress={handleExportExcel}
            accessibilityLabel="Export inventory as CSV"
          >
            <Ionicons name="download-outline" size={18} color="#FFFFFF" />
            <Text style={styles.exportBtnText}>Export CSV</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.screenTitle, { color: theme.text }]}>Inventory</Text>

        {/* Inventory: search, vendor list (tap view-only, copy stock) */}
        <OriginalInventoryManager vendors={vendors} onReload={loadVendors} readOnly={true} />

        {/* Bottom: Stock summary */}
        <View style={styles.summaryBar}>
          <Text style={styles.summaryTitle}>Stock Summary</Text>
          <View style={styles.summaryItems}>
            {vendors.length > 0 && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Vendors</Text>
                <Text style={styles.summaryValue}>{vendors.length}</Text>
              </View>
            )}
            {vendors.length > 0 && vendors.some(v => v.items && v.items.length > 0) && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Items</Text>
                <Text style={styles.summaryValue}>
                  {vendors.reduce((sum, v) => sum + (v.items?.length || 0), 0)}
                </Text>
              </View>
            )}
            {vendors.length > 0 && vendors.some(v => v.items && v.items.length > 0) && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Actual Stock</Text>
                <Text style={styles.summaryValue}>
                  {formatNaira(
                    vendors
                      .filter(v => v.items && v.items.length > 0)
                      .reduce((sum, v) => sum + v.items.reduce((s, it) => s + (it.actual || 0), 0), 0)
                  )}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl * 2,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: SPACING.md,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    marginRight: SPACING.sm,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  summaryBar: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderColor: theme.border,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: theme.textSecondary,
    marginBottom: SPACING.sm,
  },
  summaryItems: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  summaryItem: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: SPACING.sm,
    backgroundColor: theme.surface,
    borderRadius: 8,
    minWidth: 120,
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: theme.textMuted,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text,
  },
});