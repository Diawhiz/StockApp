import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, InputField, Button, EmptyState } from '../common/UIComponents';
import { createItem, updateItemPrice, deleteItem } from '../../database/itemsRepo';
import { formatNaira, parseNumber } from '../../utils/currency';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

export function ItemsManager({ items = [], onReload }) {
  const { theme } = useTheme();
  const { showAlert, showConfirm, showPrompt, showToast } = useAlert();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddItem = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      await showAlert({ title: 'Validation Error', message: 'Item name is required.', variant: 'warning' });
      return;
    }

    const parsedPrice = parseNumber(price);

    try {
      setLoading(true);
      await createItem(trimmed, parsedPrice);
      setName('');
      setPrice('');
      showToast(`Item "${trimmed}" created!`);
      onReload();
    } catch (e) {
      showAlert({ title: 'Error', message: e.message, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditPrice = async (item) => {
    const res = await showPrompt({
      title: `Edit Price: ${item.name}`,
      message: 'Enter new unit price in Naira (₦):',
      initialValue: item.price.toString(),
      keyboardType: 'numeric',
      placeholder: 'e.g. 1500',
      validate: (val) => {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0) return 'Please enter a valid price >= 0';
        return null;
      },
    });

    if (res !== null) {
      try {
        await updateItemPrice(item.id, res);
        showToast(`Price updated for ${item.name}`);
        onReload();
      } catch (e) {
        showAlert({ title: 'Error', message: e.message, variant: 'error' });
      }
    }
  };

  const handleDeleteItem = async (item) => {
    const confirmed = await showConfirm({
      title: 'Delete Item',
      message: `Are you sure you want to delete "${item.name}"? This removes it everywhere, including vendor stock balances.`,
      confirmText: 'Delete Item',
      isDestructive: true,
    });

    if (confirmed) {
      try {
        await deleteItem(item.id);
        showToast(`Item "${item.name}" deleted.`);
        onReload();
      } catch (e) {
        showAlert({ title: 'Error', message: e.message, variant: 'error' });
      }
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Add New Product Item</Text>
      
      <View style={styles.formRow}>
        <InputField
          label="Item Name"
          placeholder="e.g. Perfume Oil 50ml"
          value={name}
          onChangeText={setName}
          style={{ flex: 1.4, marginRight: SPACING.sm }}
        />
        <InputField
          label="Unit Price (₦)"
          placeholder="0"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          prefix="₦"
          style={{ flex: 1 }}
        />
      </View>

      <Button
        title="Add Product Item"
        icon="add-circle"
        onPress={handleAddItem}
        loading={loading}
        style={{ marginTop: SPACING.xs }}
      />

      <View style={[styles.listHeader, { borderTopColor: theme.border }]}>
        <Text style={[styles.subTitle, { color: theme.textSecondary }]}>
          Registered Items ({items.length})
        </Text>
      </View>

      {items.length === 0 ? (
        <EmptyState icon="pricetags-outline" message="No product items created yet." />
      ) : (
        <View style={styles.itemsList}>
          {items.map((it) => (
            <View
              key={it.id}
              style={[
                styles.itemRow,
                { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
              ]}
            >
              <View style={{ flex: 1, marginRight: SPACING.sm }}>
                <Text style={[styles.itemName, { color: theme.text }]}>{it.name}</Text>
                <Text style={[styles.itemPrice, { color: theme.primary }]}>
                  {formatNaira(it.price)}
                </Text>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: theme.border }]}
                  onPress={() => handleEditPrice(it)}
                >
                  <Ionicons name="pencil" size={16} color={theme.textSecondary} />
                  <Text style={[styles.actionText, { color: theme.textSecondary }]}>Price</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: theme.dangerLight }]}
                  onPress={() => handleDeleteItem(it)}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.danger} />
                </TouchableOpacity>
              </View>
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
  formRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  itemsList: {
    gap: SPACING.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    gap: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
