import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, StyleSheet, RefreshControl, View } from 'react-native';
import { Badge } from '../components/common/UIComponents';
import { OriginalInventoryManager } from '../components/inventory/OriginalInventoryManager';
import { LoadingSpinner } from '../components/common/UIComponents';
import { getAllVendorsWithItems } from '../database/vendorsRepo';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../styles/theme';

export function InventoryScreen() {
  const { theme } = useTheme();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadVendors = useCallback(async () => {
    try {
      const data = await getAllVendorsWithItems();
      setVendors(data);
    } catch (e) {
      console.error('Failed to load vendors', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  const onRefresh = () => {
    setRefreshing(true);
    loadVendors();
  };

  if (loading) {
    return <LoadingSpinner text="Loading inventory and stock balances..." />;
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBadgeRow}>
        <Badge label="Inventory" variant="warning" />
      </View>

      {/* Original Inventory Manager: Search, Add Vendor, Vendor Cards with Exp, Act, Miss, inline editing */}
      <OriginalInventoryManager vendors={vendors} onReload={loadVendors} />
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
  topBadgeRow: {
    marginBottom: SPACING.md,
  },
});
