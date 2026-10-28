import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, StyleSheet, RefreshControl, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LoadingSpinner } from '../components/common/UIComponents';
import { OriginalInventoryManager } from '../components/inventory/OriginalInventoryManager';
import { getAllVendorsWithItems } from '../database/vendorsRepo';
import { useTheme } from '../context/ThemeContext';
import { SPACING } from '../styles/theme';

export function InventoryScreen() {
  const { theme } = useTheme();

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
      <Text style={[styles.screenTitle, { color: theme.text }]}>Inventory</Text>

      {/* Inventory: search, Excel import, vendor list (tap a vendor to manage it) */}
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
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: SPACING.md,
  },
});
