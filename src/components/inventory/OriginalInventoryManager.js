import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Card, Badge, EmptyState } from '../common/UIComponents';
import {
  createVendor,
  deleteVendor,
  addVendorItem,
  updateVendorItem,
  deleteVendorItem,
} from '../../database/vendorsRepo';
import { formatNaira, parseNumber } from '../../utils/currency';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';
import { ExcelImportModal } from './ExcelImportModal';
import { downloadExcelTemplate } from '../../utils/excelParser';
import {
  executeStockImport,
  getLastActiveImport,
  undoLastImport,
} from '../../database/stockImportRepo';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CARD_ACCENTS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#06B6D4', '#6366F1'];

export function OriginalInventoryManager({ vendors = [], onReload }) {
  const { theme, isDark } = useTheme();
  const { showAlert, showConfirm, showPrompt, showToast } = useAlert();

  const [searchQuery, setSearchQuery] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [addingVendor, setAddingVendor] = useState(false);

  // Accordion state: which vendor card is expanded (one open at a time)
  const [expandedVendorId, setExpandedVendorId] = useState(null);

  // Form states per vendor for adding items
  const [itemForms, setItemForms] = useState({});

  // Excel Import state
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [hasUndoImport, setHasUndoImport] = useState(false);

  React.useEffect(() => {
    checkUndoStatus();
  }, [vendors]);

  const checkUndoStatus = async () => {
    try {
      const active = await getLastActiveImport();
      setHasUndoImport(!!active);
    } catch {
      setHasUndoImport(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      showToast('Preparing template...');
      await downloadExcelTemplate();
    } catch (err) {
      showAlert({
        title: 'Download Failed',
        message: err.message || 'Could not download template.',
        variant: 'error',
      });
    }
  };

  const handleImportCommit = async (importParams) => {
    const summary = await executeStockImport(importParams);
    await showAlert({
      title: 'Import Successful',
      message:
        `Excel Stock Import Complete!\n\n` +
        `• Vendors Added: ${summary.vendorsAdded}\n` +
        `• Items Added: ${summary.itemsAdded}\n` +
        `• Stock Rows Updated: ${summary.itemsUpdated}\n` +
        `• Units Processed: ${summary.totalUnits}\n` +
        `• Rows Skipped: ${summary.rowsSkipped}\n` +
        `• Mode: ${summary.mode.toUpperCase()}`,
      variant: 'success',
    });
    onReload();
    checkUndoStatus();
  };

  const handleUndoImport = async () => {
    const confirmed = await showConfirm({
      title: 'Undo Last Import',
      message:
        'Are you sure you want to reverse the most recent Excel import? ' +
        'This will restore stock quantities and remove items created solely by that import.',
      confirmText: 'Undo Import',
      cancelText: 'Cancel',
      isDestructive: true,
    });

    if (confirmed) {
      try {
        const undone = await undoLastImport();
        showToast('Last import successfully reversed!');
        await showAlert({
          title: 'Import Reversed',
          message: `The import from ${new Date(undone.timestamp).toLocaleString()} has been undone.`,
          variant: 'info',
        });
        onReload();
        checkUndoStatus();
      } catch (err) {
        showAlert({
          title: 'Undo Failed',
          message: err.message || 'Could not undo the last import.',
          variant: 'error',
        });
      }
    }
  };

  const toggleVendor = (vendorId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedVendorId((prev) => (prev === vendorId ? null : vendorId));
  };

  const handleAddVendor = async () => {
    const trimmed = newVendorName.trim();
    if (!trimmed) {
      await showAlert({ title: 'Validation Error', message: 'Vendor name is required.', variant: 'warning' });
      return;
    }

    try {
      setAddingVendor(true);
      await createVendor(trimmed);
      setNewVendorName('');
      showToast(`Vendor "${trimmed}" added!`);
      onReload();
    } catch (e) {
      showAlert({ title: 'Error', message: e.message, variant: 'error' });
    } finally {
      setAddingVendor(false);
    }
  };

  const handleDeleteVendor = async (vendor) => {
    const confirmed = await showConfirm({
      title: 'Delete Vendor',
      message: `Are you sure you want to delete "${vendor.name}" and all its inventory items? This cannot be undone.`,
      confirmText: 'Delete Vendor',
      isDestructive: true,
    });

    if (confirmed) {
      try {
        await deleteVendor(vendor.id);
        showToast(`Vendor "${vendor.name}" deleted.`);
        onReload();
      } catch (e) {
        showAlert({ title: 'Error', message: e.message, variant: 'error' });
      }
    }
  };

  const updateItemFormField = (vendorId, field, val) => {
    setItemForms((prev) => ({
      ...prev,
      [vendorId]: {
        ...(prev[vendorId] || { name: '', exp: '', act: '', price: '' }),
        [field]: val,
      },
    }));
  };

  const handleAddItemToVendor = async (vendorId) => {
    const form = itemForms[vendorId] || { name: '', exp: '', act: '', price: '' };
    const trimmed = (form.name || '').trim();

    if (!trimmed) {
      await showAlert({ title: 'Validation Error', message: 'Item name is required.', variant: 'warning' });
      return;
    }

    const exp = parseInt(form.exp, 10) || 0;
    const act = parseInt(form.act, 10) || 0;
    const price = parseNumber(form.price);

    try {
      await addVendorItem(vendorId, {
        name: trimmed,
        price,
        expected: exp,
        actual: act,
      });

      // Clear form
      setItemForms((prev) => ({
        ...prev,
        [vendorId]: { name: '', exp: '', act: '', price: '' },
      }));

      showToast(`Item "${trimmed}" added!`);
      onReload();
    } catch (e) {
      showAlert({ title: 'Error', message: e.message, variant: 'error' });
    }
  };

  const handleInlineItemUpdate = async (itemId, field, text) => {
    try {
      if (field === 'expected' || field === 'actual') {
        const num = parseInt(text, 10) || 0;
        await updateVendorItem(itemId, { [field]: num });
      } else if (field === 'price') {
        const num = parseNumber(text);
        await updateVendorItem(itemId, { price: num });
      }
      onReload();
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

    if (confirmed) {
      try {
        await deleteVendorItem(item.id);
        showToast(`Item "${item.name}" removed.`);
        onReload();
      } catch (e) {
        showAlert({ title: 'Error', message: e.message, variant: 'error' });
      }
    }
  };

  const handleCopyVendorStock = async (vendor) => {
    if (!vendor.items || vendor.items.length === 0) {
      await showAlert({
        title: 'Empty Stock',
        message: `Vendor ${vendor.name} has no items in stock.`,
        variant: 'info',
      });
      return;
    }

    let text = `--- ${vendor.name.toUpperCase()} STOCK ---\n`;
    vendor.items.forEach((item) => {
      text += `• ${item.name}: ${item.expected} (Act: ${item.actual}, Miss: ${item.missing})\n`;
    });

    await Clipboard.setStringAsync(text.trim());
    showToast(`Stock for ${vendor.name} Copied!`);
  };

  const handleCopyAllStock = async () => {
    const activeVendors = vendors.filter((v) => v.items && v.items.length > 0);
    if (activeVendors.length === 0) {
      await showAlert({ title: 'No Data', message: 'No inventory to copy.', variant: 'info' });
      return;
    }

    let text = `=== GENERAL STOCK REPORT ===\n\n`;
    activeVendors.forEach((vendor, index) => {
      text += `--- ${vendor.name.toUpperCase()} STOCK ---\n`;
      vendor.items.forEach((item) => {
        text += `• ${item.name}: ${item.expected} (Act: ${item.actual}, Miss: ${item.missing})\n`;
      });
      if (index < activeVendors.length - 1) {
        text += '\n';
      }
    });

    await Clipboard.setStringAsync(text.trim());
    showToast('All Inventory Copied!');
  };

  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search vendors..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Excel Import Bar */}
      <Card style={styles.importActionCard}>
        <View style={styles.importHeaderRow}>
          <View style={styles.importHeaderTitle}>
            <Ionicons name="cube" size={18} color={theme.primary} />
            <Text style={[styles.importSectionTitle, { color: theme.text }]}>Excel Stock Import</Text>
          </View>

          {hasUndoImport && (
            <TouchableOpacity
              style={[styles.undoBtn, { borderColor: theme.dangerLight, backgroundColor: theme.dangerLight }]}
              onPress={handleUndoImport}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-undo" size={14} color={theme.danger} />
              <Text style={[styles.undoBtnText, { color: theme.danger }]}>Undo Last Import</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.importButtonsRow}>
          <TouchableOpacity
            style={[styles.importMainBtn, { backgroundColor: theme.primary }]}
            onPress={() => setImportModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
            <Text style={styles.importMainBtnText}>Import Excel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.templateBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
            onPress={handleDownloadTemplate}
            activeOpacity={0.8}
          >
            <Ionicons name="download-outline" size={18} color={theme.text} />
            <Text style={[styles.templateBtnText, { color: theme.text }]}>Download Template</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Add Vendor Form & Copy All Header */}
      <Card style={styles.addVendorCard}>
        <View style={styles.topActionsRow}>
          <Text style={[styles.sectionHeading, { color: theme.text }]}>Add Vendor</Text>
          <TouchableOpacity
            style={[styles.copyAllBtn, { backgroundColor: theme.primary }]}
            onPress={handleCopyAllStock}
            activeOpacity={0.8}
          >
            <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
            <Text style={styles.copyAllBtnText}>Copy General Stock</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.addVendorRow}>
          <TextInput
            style={[
              styles.addVendorInput,
              {
                backgroundColor: theme.inputBg,
                borderColor: theme.border,
                color: theme.text,
              },
            ]}
            placeholder="New vendor name..."
            placeholderTextColor={theme.textMuted}
            value={newVendorName}
            onChangeText={setNewVendorName}
            onSubmitEditing={handleAddVendor}
          />
          <TouchableOpacity
            style={[styles.addVendorBtn, { backgroundColor: theme.primary }]}
            onPress={handleAddVendor}
            disabled={addingVendor}
          >
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Card>

      {/* Vendors List */}
      <View style={styles.vendorsListContainer}>
        <Text style={[styles.listTitle, { color: theme.textSecondary }]}>
          Vendors & Stock ({filteredVendors.length})
        </Text>

        {filteredVendors.length === 0 ? (
          <EmptyState
            icon="storefront-outline"
            message={searchQuery ? 'No matching vendors found.' : 'No vendors added yet.'}
          />
        ) : (
          filteredVendors.map((vendor, index) => {
            const isExpanded = expandedVendorId === vendor.id;
            const accentColor = CARD_ACCENTS[index % CARD_ACCENTS.length];
            const form = itemForms[vendor.id] || { name: '', exp: '', act: '', price: '' };

            const totalActualStock = vendor.items.reduce((acc, it) => acc + (it.actual || 0), 0);
            const totalExpectedStock = vendor.items.reduce((acc, it) => acc + (it.expected || 0), 0);
            const totalMissingStock = vendor.items.reduce((acc, it) => acc + (it.missing || 0), 0);

            return (
              <Card key={vendor.id} style={[styles.vendorCard, { padding: 0 }]}>
                {/* Accent line on top */}
                <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

                {/* Vendor Header */}
                <TouchableOpacity
                  style={[
                    styles.vendorHeader,
                    {
                      backgroundColor: isExpanded ? theme.surfaceAlt : theme.surface,
                      borderBottomColor: theme.border,
                      borderBottomWidth: isExpanded ? 1 : 0,
                    },
                  ]}
                  onPress={() => toggleVendor(vendor.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, marginRight: SPACING.sm }}>
                    <Text style={[styles.vendorName, { color: theme.text }]}>{vendor.name}</Text>
                    <Text style={[styles.vendorSubtitle, { color: theme.textSecondary }]}>
                      {vendor.items.length} {vendor.items.length === 1 ? 'item' : 'items'} | Act:{' '}
                      <Text style={{ fontWeight: '700', color: theme.primary }}>{totalActualStock}</Text> | Exp:{' '}
                      <Text style={{ fontWeight: '700' }}>{totalExpectedStock}</Text> | Miss:{' '}
                      <Text style={{ fontWeight: '700', color: totalMissingStock > 0 ? theme.danger : theme.success }}>
                        {totalMissingStock}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.vendorHeaderRight}>
                    <TouchableOpacity
                      style={[styles.headerActionBtn, { borderColor: theme.border }]}
                      onPress={() => handleCopyVendorStock(vendor)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="copy-outline" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.headerActionBtn, { borderColor: theme.dangerLight }]}
                      onPress={() => handleDeleteVendor(vendor)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.danger} />
                    </TouchableOpacity>

                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={theme.textSecondary}
                      style={{ marginLeft: 4 }}
                    />
                  </View>
                </TouchableOpacity>

                {/* Expanded Body: Add Item & Item Table */}
                {isExpanded && (
                  <View style={[styles.expandedBody, { backgroundColor: theme.surface }]}>
                    {/* Add Item Row matching original app */}
                    <Text style={[styles.subHeading, { color: theme.textSecondary }]}>Add Product Item</Text>
                    <View style={styles.addItemFormRow}>
                      <TextInput
                        style={[
                          styles.itemFormInput,
                          { flex: 2, backgroundColor: theme.surfaceAlt, borderColor: theme.border, color: theme.text },
                        ]}
                        placeholder="Item Name"
                        placeholderTextColor={theme.textMuted}
                        value={form.name}
                        onChangeText={(txt) => updateItemFormField(vendor.id, 'name', txt)}
                      />
                      <TextInput
                        style={[
                          styles.itemFormInput,
                          { flex: 1.1, backgroundColor: theme.surfaceAlt, borderColor: theme.border, color: theme.text },
                        ]}
                        placeholder="Exp."
                        placeholderTextColor={theme.textMuted}
                        keyboardType="numeric"
                        value={form.exp}
                        onChangeText={(txt) => updateItemFormField(vendor.id, 'exp', txt)}
                      />
                      <TextInput
                        style={[
                          styles.itemFormInput,
                          { flex: 1.1, backgroundColor: theme.surfaceAlt, borderColor: theme.border, color: theme.text },
                        ]}
                        placeholder="Act."
                        placeholderTextColor={theme.textMuted}
                        keyboardType="numeric"
                        value={form.act}
                        onChangeText={(txt) => updateItemFormField(vendor.id, 'act', txt)}
                      />
                      <TextInput
                        style={[
                          styles.itemFormInput,
                          { flex: 1.2, backgroundColor: theme.surfaceAlt, borderColor: theme.border, color: theme.text },
                        ]}
                        placeholder="₦ Price"
                        placeholderTextColor={theme.textMuted}
                        keyboardType="numeric"
                        value={form.price}
                        onChangeText={(txt) => updateItemFormField(vendor.id, 'price', txt)}
                      />
                      <TouchableOpacity
                        style={[styles.addItemBtn, { backgroundColor: theme.accent }]}
                        onPress={() => handleAddItemToVendor(vendor.id)}
                      >
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>

                    {/* Table of Items */}
                    {vendor.items.length === 0 ? (
                      <Text style={[styles.emptyItemsText, { color: theme.textMuted }]}>
                        No items in stock. Use the form above to add items.
                      </Text>
                    ) : (
                      <View style={styles.tableContainer}>
                        {/* Table Header */}
                        <View style={[styles.tableHeader, { borderBottomColor: theme.border }]}>
                          <Text style={[styles.thText, { flex: 2, color: theme.textMuted }]}>Item</Text>
                          <Text style={[styles.thText, { flex: 1, textAlign: 'center', color: theme.textMuted }]}>Exp</Text>
                          <Text style={[styles.thText, { flex: 1, textAlign: 'center', color: theme.textMuted }]}>Act</Text>
                          <Text style={[styles.thText, { flex: 1, textAlign: 'center', color: theme.textMuted }]}>Miss</Text>
                          <Text style={[styles.thText, { flex: 1.2, textAlign: 'right', color: theme.textMuted }]}>Price</Text>
                          <View style={{ width: 30 }} />
                        </View>

                        {/* Table Rows with inline editable Act & Exp */}
                        {vendor.items.map((item) => (
                          <View key={item.id} style={[styles.tableRow, { borderBottomColor: theme.divider }]}>
                            <Text style={[styles.itemNameText, { flex: 2, color: theme.text }]} numberOfLines={2}>
                              {item.name}
                            </Text>

                            {/* Editable Exp Cell */}
                            <View style={[styles.cellWrapper, { flex: 1, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                              <TextInput
                                style={[styles.cellInput, { color: theme.text }]}
                                keyboardType="numeric"
                                defaultValue={String(item.expected)}
                                onEndEditing={(e) => handleInlineItemUpdate(item.id, 'expected', e.nativeEvent.text)}
                              />
                            </View>

                            {/* Editable Act Cell */}
                            <View style={[styles.cellWrapper, { flex: 1, backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                              <TextInput
                                style={[styles.cellInput, { color: theme.text }]}
                                keyboardType="numeric"
                                defaultValue={String(item.actual)}
                                onEndEditing={(e) => handleInlineItemUpdate(item.id, 'actual', e.nativeEvent.text)}
                              />
                            </View>

                            {/* Missing Badge */}
                            <View
                              style={[
                                styles.missBadge,
                                {
                                  flex: 1,
                                  backgroundColor: item.missing > 0 ? theme.dangerLight : theme.successLight,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.missText,
                                  { color: item.missing > 0 ? theme.danger : theme.success },
                                ]}
                              >
                                {item.missing}
                              </Text>
                            </View>

                            {/* Price Cell */}
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
                              <Text style={[styles.priceText, { color: theme.primary }]}>
                                {formatNaira(item.price)}
                              </Text>
                            </TouchableOpacity>

                            {/* Delete Item */}
                            <TouchableOpacity
                              style={styles.deleteItemBtn}
                              onPress={() => handleDeleteItem(item)}
                            >
                              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </Card>
            );
          })
        )}
      </View>

      {/* Excel Import Modal */}
      <ExcelImportModal
        visible={importModalVisible}
        onClose={() => setImportModalVisible(false)}
        existingVendors={vendors}
        onImportCommit={handleImportCommit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xl,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    height: 44,
    marginBottom: SPACING.md,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  addVendorCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
  },
  copyAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  copyAllBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  addVendorRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  addVendorInput: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
  },
  addVendorBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vendorsListContainer: {
    gap: SPACING.sm,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  vendorCard: {
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  cardAccent: {
    height: 4,
    width: '100%',
  },
  vendorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '700',
  },
  vendorSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },
  vendorHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    padding: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  expandedBody: {
    padding: SPACING.md,
  },
  subHeading: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  addItemFormRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  itemFormInput: {
    height: 38,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    fontSize: 13,
  },
  addItemBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyItemsText: {
    paddingVertical: SPACING.md,
    textAlign: 'center',
    fontStyle: 'italic',
    fontSize: 13,
  },
  tableContainer: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 6,
    marginBottom: 4,
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemNameText: {
    fontSize: 13,
    fontWeight: '600',
    paddingRight: 6,
  },
  cellWrapper: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    marginHorizontal: 2,
    height: 32,
    justifyContent: 'center',
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
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importActionCard: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  importHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  importHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  importSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    gap: 4,
  },
  undoBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  importButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  importMainBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  importMainBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  templateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 6,
  },
  templateBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
