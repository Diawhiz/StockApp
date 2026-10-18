import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, InputField, Button, EmptyState } from '../common/UIComponents';
import { createVendor, deleteVendor } from '../../database/vendorsRepo';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

export function VendorsManager({ vendors = [], onReload }) {
  const { theme } = useTheme();
  const { showAlert, showConfirm, showToast } = useAlert();

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddVendor = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      await showAlert({ title: 'Validation Error', message: 'Vendor name is required.', variant: 'warning' });
      return;
    }

    try {
      setLoading(true);
      await createVendor(trimmed);
      setName('');
      showToast(`Vendor "${trimmed}" added!`);
      onReload();
    } catch (e) {
      showAlert({ title: 'Error', message: e.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVendor = async (vendor) => {
    const confirmed = await showConfirm({
      title: 'Delete Vendor',
      message: `Are you sure you want to delete "${vendor.name}"? This removes all of this vendor's stock balances.`,
      confirmText: 'Delete Vendor',
      isDestructive: true,
    });

    if (confirmed) {
      try {
        await deleteVendor(vendor.id);
        showToast(`Vendor "${vendor.name}" removed.`);
        onReload();
      } catch (e) {
        showAlert({ title: 'Error', message: e.message, variant: 'error' });
      }
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Add New Vendor</Text>
      
      <InputField
        label="Vendor Name"
        placeholder="e.g. Adeola Fabrics"
        value={name}
        onChangeText={setName}
      />

      <Button
        title="Add Vendor"
        icon="person-add"
        onPress={handleAddVendor}
        loading={loading}
      />

      <View style={[styles.listHeader, { borderTopColor: theme.border }]}>
        <Text style={[styles.subTitle, { color: theme.textSecondary }]}>
          Registered Vendors ({vendors.length})
        </Text>
      </View>

      {vendors.length === 0 ? (
        <EmptyState icon="business-outline" message="No vendors added yet." />
      ) : (
        <View style={styles.vendorList}>
          {vendors.map((v) => (
            <View
              key={v.id}
              style={[
                styles.vendorRow,
                { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
              ]}
            >
              <View style={{ flex: 1, marginRight: SPACING.sm }}>
                <Text style={[styles.vendorName, { color: theme.text }]}>{v.name}</Text>
              </View>

              <TouchableOpacity
                style={[styles.deleteBtn, { borderColor: theme.dangerLight }]}
                onPress={() => handleDeleteVendor(v)}
              >
                <Ionicons name="trash-outline" size={16} color={theme.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
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
  listHeader: {
    borderTopWidth: 1,
    paddingTop: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  subTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  vendorList: {
    gap: SPACING.sm,
  },
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  vendorName: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
});
