import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState } from '../common/UIComponents';
import { deleteDelivery } from '../../database/deliveriesRepo';
import { formatNaira } from '../../utils/currency';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

export function DeliveredOrdersList({
  deliveries = [],
  onEditDelivery,
  onDeliveryDeleted,
}) {
  const { theme } = useTheme();
  const { showConfirm, showToast, showAlert } = useAlert();
  const [orderQuery, setOrderQuery] = useState('');

  // Group deliveries by rider
  const riderGroups = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    const visible = q
      ? deliveries.filter(
          (d) =>
            (d.location || '').toLowerCase().includes(q) ||
            (d.product || '').toLowerCase().includes(q) ||
            (d.rider || '').toLowerCase().includes(q)
        )
      : deliveries;
    const map = new Map();
    for (const d of visible) {
      const riderName = (d.rider || 'Unassigned').trim();
      if (!map.has(riderName)) {
        map.set(riderName, {
          rider: riderName,
          totalPrice: 0,
          orders: [],
        });
      }
      const group = map.get(riderName);
      group.totalPrice += d.price || 0;
      group.orders.push(d);
    }
    return Array.from(map.values());
  }, [deliveries, orderQuery]);

  const handleDelete = async (delivery) => {
    const confirmed = await showConfirm({
      title: 'Delete Delivery',
      message: `Delete delivery for ${delivery.location}? Its deducted stock will be returned to inventory.`,
      confirmText: 'Delete & Restore Stock',
      isDestructive: true,
    });

    if (confirmed) {
      try {
        await deleteDelivery(delivery.id);
        showToast('Delivery deleted and stock restored.');
        onDeliveryDeleted();
      } catch (e) {
        showAlert({ title: 'Error', message: e.message, variant: 'error' });
      }
    }
  };

  if (deliveries.length === 0 && riderGroups.length === 0) {
    return (
      <Card>
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Delivered Orders</Text>
        <EmptyState icon="bicycle-outline" message="No deliveries for this date." />
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeading, { color: theme.text, marginBottom: SPACING.sm }]}>
        Delivered Orders ({riderGroups.reduce((acc, g) => acc + g.orders.length, 0)})
      </Text>

      <View style={[styles.searchContainer, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
        <Ionicons name="search" size={16} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search orders by location, product, rider..."
          placeholderTextColor={theme.textMuted}
          value={orderQuery}
          onChangeText={setOrderQuery}
        />
        {orderQuery.length > 0 && (
          <TouchableOpacity onPress={() => setOrderQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {riderGroups.length === 0 ? (
        <Card>
          <EmptyState icon="search-outline" message="No orders match your search." />
        </Card>
      ) : (
        riderGroups.map((group) => (
        <Card key={group.rider} style={styles.riderCard}>
          {/* Rider Header */}
          <View style={[styles.riderHeader, { borderBottomColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="person" size={16} color={theme.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.riderTitle, { color: theme.text }]}>
                Rider: {group.rider}
              </Text>
            </View>
            <Text style={[styles.riderSubtotal, { color: theme.primary }]}>
              Subtotal: {formatNaira(group.totalPrice)}
            </Text>
          </View>

          {/* Orders */}
          <View style={styles.ordersList}>
            {group.orders.map((d) => (
              <View
                key={d.id}
                style={[
                  styles.orderRow,
                  { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                ]}
              >
                <View style={{ flex: 1, marginRight: SPACING.sm }}>
                  <Text style={[styles.orderText, { color: theme.text }]}>
                    <Text style={{ fontWeight: '700' }}>{d.location}:</Text> {d.product} -{' '}
                    <Text style={{ fontWeight: '700', color: theme.primary }}>
                      {formatNaira(d.price)}
                    </Text>{' '}
                    <Text style={{ color: theme.textMuted }}>(Fee: {formatNaira(d.fee)})</Text>
                  </Text>
                  {d.items && d.items.length > 0 && (
                    <Text style={[styles.itemSnapshotNote, { color: theme.textSecondary }]}>
                      📦 Deducted:{' '}
                      {d.items
                        .map(
                          (it) => `${it.item_name_snapshot} ×${it.quantity} (${it.vendor_name_snapshot})`
                        )
                        .join(', ')}
                    </Text>
                  )}
                </View>

                <View style={styles.actionBtns}>
                  <TouchableOpacity
                    style={[styles.btn, { borderColor: theme.border }]}
                    onPress={() => onEditDelivery(d)}
                  >
                    <Ionicons name="pencil" size={15} color={theme.textSecondary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btn, { borderColor: theme.dangerLight }]}
                    onPress={() => handleDelete(d)}
                  >
                    <Ionicons name="trash-outline" size={15} color={theme.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </Card>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    height: 42,
    marginBottom: SPACING.md,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  riderCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  riderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    marginBottom: SPACING.sm,
  },
  riderTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  riderSubtotal: {
    fontSize: 13,
    fontWeight: '700',
  },
  ordersList: {
    gap: SPACING.xs,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  orderText: {
    fontSize: 14,
    lineHeight: 20,
  },
  itemSnapshotNote: {
    fontSize: 12,
    marginTop: 4,
  },
  actionBtns: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  btn: {
    padding: 7,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
});
