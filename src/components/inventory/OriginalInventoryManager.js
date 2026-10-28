import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Card, EmptyState } from '../common/UIComponents';
import { createVendor } from '../../database/vendorsRepo';
import { goToVendorDetail } from '../../navigation/navRef';
import { formatNaira } from '../../utils/currency';
import { buildVendorStockText, buildAllStockText } from '../../utils/stockCopy';
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

export function OriginalInventoryManager({ vendors = [], onReload }) {
  const { theme } = useTheme();
  const { showAlert, showConfirm, showToast } = useAlert();

  const [searchQuery, setSearchQuery] = useState('');
  const [newVendorName, setNewVendorName] = useState('');
  const [addingVendor, setAddingVendor] = useState(false);

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

  const handleCopyVendorStock = async (vendor) => {
    if (!vendor.items || vendor.items.length === 0) {
      await showAlert({
        title: 'Empty Stock',
        message: `Vendor ${vendor.name} has no items in stock.`,
        variant: 'info',
      });
      return;
    }

    await Clipboard.setStringAsync(buildVendorStockText(vendor).trim());
    showToast(`Stock for ${vendor.name} Copied!`);
  };

  const handleCopyAllStock = async () => {
    const activeVendors = vendors.filter((v) => v.items && v.items.length > 0);
    if (activeVendors.length === 0) {
      await showAlert({ title: 'No Data', message: 'No inventory to copy.', variant: 'info' });
      return;
    }

    await Clipboard.setStringAsync(buildAllStockText(activeVendors).trim());
    showToast('All Inventory Copied!');
  };

  const query = searchQuery.trim().toLowerCase();
  const searchResults = vendors
    .map((v) => {
      const nameMatch = !query || v.name.toLowerCase().includes(query);
      const matchedItems = query ? v.items.filter((it) => it.name.toLowerCase().includes(query)) : [];
      if (!nameMatch && matchedItems.length === 0) return null;
      return { vendor: v, matchedItems, viaItem: !nameMatch && matchedItems.length > 0 };
    })
    .filter(Boolean);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
        <Ionicons name="search" size={18} color={theme.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search vendors or products..."
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

      {/* Add Vendor + Copy General Stock */}
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
          Vendors ({searchResults.length})
        </Text>

        {searchResults.length === 0 ? (
          <EmptyState
            icon="storefront-outline"
            message={query ? 'No matching vendors or products found.' : 'No vendors added yet.'}
          />
        ) : (
          searchResults.map(({ vendor, matchedItems, viaItem }) => {
            const totalExpected = vendor.items.reduce((acc, it) => acc + (it.expected || 0), 0);
            const totalValue = vendor.items.reduce((acc, it) => acc + (it.price || 0) * (it.actual || 0), 0);

            return (
              <View
                key={vendor.id}
                style={[styles.vendorRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <TouchableOpacity
                  style={styles.vendorRowMain}
                  onPress={() => goToVendorDetail(vendor.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.vendorName, { color: theme.text }]} numberOfLines={1}>
                    {vendor.name}
                  </Text>
                  <Text style={[styles.vendorSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                    {viaItem
                      ? `Product match: ${matchedItems[0].name}${matchedItems.length > 1 ? ` +${matchedItems.length - 1} more` : ''}`
                      : `${vendor.items.length} ${vendor.items.length === 1 ? 'product' : 'products'} · Exp ${totalExpected} · ${formatNaira(totalValue)}`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.rowActionBtn}
                  onPress={() => handleCopyVendorStock(vendor)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="copy-outline" size={17} color={theme.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => goToVendorDetail(vendor.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
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
  vendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  vendorRowMain: {
    flex: 1,
    paddingRight: SPACING.xs,
  },
  vendorName: {
    fontSize: 15,
    fontWeight: '700',
  },
  vendorSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },
  rowActionBtn: {
    padding: 6,
  },
});
