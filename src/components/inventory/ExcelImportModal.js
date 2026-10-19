import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { parseExcelStockFile } from '../../utils/excelParser';
import { matchImportDataWithDatabase } from '../../utils/stockMatcher';
import { formatNaira } from '../../utils/currency';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

export function ExcelImportModal({ visible, onClose, existingVendors = [], onImportCommit }) {
  const { theme } = useTheme();
  const { showAlert } = useAlert();

  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [matchResult, setMatchResult] = useState(null);

  // Settings
  const [importMode, setImportMode] = useState('add'); // 'add' | 'replace'
  const [warningActions, setWarningActions] = useState({}); // warningId -> 'merge' | 'keep'
  const [priceSelections, setPriceSelections] = useState({}); // itemId -> 'old' | 'new'

  const resetState = () => {
    setParsing(false);
    setSaving(false);
    setFileName('');
    setParsedData(null);
    setMatchResult(null);
    setImportMode('add');
    setWarningActions({});
    setPriceSelections({});
  };

  const handleClose = () => {
    if (saving) return;
    resetState();
    onClose();
  };

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/octet-stream',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      const name = asset.name || 'Stock_Import.xlsx';

      if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
        await showAlert({
          title: 'Invalid File Type',
          message: 'Please choose an Excel file (.xlsx or .xls).',
          variant: 'warning',
        });
        return;
      }

      setFileName(name);
      setParsing(true);

      const parsed = await parseExcelStockFile(asset.uri);
      const match = matchImportDataWithDatabase(parsed.validRows, existingVendors);

      setParsedData(parsed);
      setMatchResult(match);

      // Default warning actions to 'keep'
      const initWarnings = {};
      match.nearDuplicateWarnings.forEach((w) => {
        initWarnings[w.id] = 'keep';
      });
      setWarningActions(initWarnings);

      // Default price conflicts to 'old'
      const initPrices = {};
      match.priceConflicts.forEach((p) => {
        initPrices[p.itemId] = 'old';
      });
      setPriceSelections(initPrices);
    } catch (err) {
      showAlert({
        title: 'Error Parsing File',
        message: err.message || 'Could not parse the selected Excel file.',
        variant: 'error',
      });
      setFileName('');
      setParsedData(null);
      setMatchResult(null);
    } finally {
      setParsing(false);
    }
  };

  const toggleWarningAction = (warningId) => {
    setWarningActions((prev) => ({
      ...prev,
      [warningId]: prev[warningId] === 'merge' ? 'keep' : 'merge',
    }));
  };

  const setPriceChoice = (itemId, choice) => {
    setPriceSelections((prev) => ({
      ...prev,
      [itemId]: choice,
    }));
  };

  const handleConfirmImport = async () => {
    if (!matchResult || !parsedData) return;
    try {
      setSaving(true);
      await onImportCommit({
        matchResult,
        parsedData,
        importMode,
        warningActions,
        priceSelections,
      });
      resetState();
      onClose();
    } catch (err) {
      showAlert({
        title: 'Import Failed',
        message: err.message || 'An error occurred during import.',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const validRowCount = parsedData ? parsedData.validRows.length : 0;
  const skippedCount = parsedData ? parsedData.skippedRows.length : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        {/* Top Header */}
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.headerLeft}>
            <Ionicons name="document-text-outline" size={24} color={theme.primary} />
            <Text style={[styles.headerTitle, { color: theme.text }]}>Import Vendor Stock</Text>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: theme.surfaceAlt }]}
            onPress={handleClose}
            disabled={saving}
          >
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* File Picker Banner */}
          <View style={[styles.pickerBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flex: 1, marginRight: SPACING.md }}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>
                {fileName ? fileName : 'No Excel file selected'}
              </Text>
              <Text style={[styles.pickerSub, { color: theme.textSecondary }]}>
                {fileName
                  ? `Worksheet: "${parsedData?.sheetName || 'Stock Import'}"`
                  : 'Select an .xlsx sheet with Vendor, Item, Quantity & Price.'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.chooseBtn, { backgroundColor: theme.primary }]}
              onPress={handlePickFile}
              disabled={parsing || saving}
              activeOpacity={0.8}
            >
              {parsing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="folder-open-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.chooseBtnText}>{fileName ? 'Change' : 'Choose File'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Loading Indicator */}
          {parsing && (
            <View style={styles.parsingBox}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={[styles.parsingText, { color: theme.textSecondary }]}>
                Reading and validating Excel file...
              </Text>
            </View>
          )}

          {/* Preview Section */}
          {matchResult && !parsing && (
            <>
              {/* Summary Badges Row */}
              <View style={styles.summaryGrid}>
                <View style={[styles.statBadge, { backgroundColor: theme.primaryLight }]}>
                  <Text style={[styles.statValue, { color: theme.primary }]}>
                    {matchResult.counts.newVendors}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.primary }]}>New Vendors</Text>
                </View>

                <View style={[styles.statBadge, { backgroundColor: theme.infoLight || '#E0F2FE' }]}>
                  <Text style={[styles.statValue, { color: theme.info || '#0284C7' }]}>
                    {matchResult.counts.newItems}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.info || '#0284C7' }]}>New Items</Text>
                </View>

                <View style={[styles.statBadge, { backgroundColor: theme.successLight }]}>
                  <Text style={[styles.statValue, { color: theme.success }]}>
                    {matchResult.counts.updateStockRows}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.success }]}>Rows to Update</Text>
                </View>

                <View style={[styles.statBadge, { backgroundColor: theme.surfaceAlt }]}>
                  <Text style={[styles.statValue, { color: theme.text }]}>
                    {matchResult.counts.totalUnits}
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total Units</Text>
                </View>
              </View>

              {/* Mode Selector */}
              <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Import Mode</Text>
                <View style={styles.modeRow}>
                  <TouchableOpacity
                    style={[
                      styles.modeOption,
                      importMode === 'add'
                        ? { backgroundColor: theme.primary, borderColor: theme.primary }
                        : { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                    ]}
                    onPress={() => setImportMode('add')}
                  >
                    <Ionicons
                      name="add-circle"
                      size={18}
                      color={importMode === 'add' ? '#FFFFFF' : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.modeOptionText,
                        { color: importMode === 'add' ? '#FFFFFF' : theme.text },
                      ]}
                    >
                      Add Mode
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeOption,
                      importMode === 'replace'
                        ? { backgroundColor: theme.primary, borderColor: theme.primary }
                        : { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                    ]}
                    onPress={() => setImportMode('replace')}
                  >
                    <Ionicons
                      name="sync"
                      size={18}
                      color={importMode === 'replace' ? '#FFFFFF' : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.modeOptionText,
                        { color: importMode === 'replace' ? '#FFFFFF' : theme.text },
                      ]}
                    >
                      Replace Mode
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Plain Words Explanation */}
                <View style={[styles.modeExplanation, { backgroundColor: theme.surfaceAlt }]}>
                  <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
                  <Text style={[styles.modeExplanationText, { color: theme.text }]}>
                    {importMode === 'add'
                      ? 'Quantities in the Excel file will be ADDED to existing vendor stock balances.'
                      : 'Vendor stock balances will be SET DIRECTLY to the quantities in the Excel file.'}
                  </Text>
                </View>
              </View>

              {/* Near Duplicate Warnings */}
              {matchResult.nearDuplicateWarnings.length > 0 && (
                <View
                  style={[
                    styles.sectionCard,
                    { backgroundColor: theme.warningLight, borderColor: theme.warning },
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <Ionicons name="warning-outline" size={20} color={theme.warning} />
                    <Text style={[styles.sectionTitle, { color: theme.warning, marginLeft: 6 }]}>
                      Near-Duplicate Name Warnings ({matchResult.nearDuplicateWarnings.length})
                    </Text>
                  </View>
                  <Text style={[styles.warningHelp, { color: theme.textSecondary }]}>
                    We found names very similar to existing records. Choose whether to merge or keep separate:
                  </Text>

                  {matchResult.nearDuplicateWarnings.map((w) => {
                    const isMerge = warningActions[w.id] === 'merge';
                    return (
                      <View
                        key={w.id}
                        style={[styles.warningItem, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      >
                        <View style={{ flex: 1, marginRight: SPACING.sm }}>
                          <Text style={[styles.warningIncoming, { color: theme.text }]}>
                            File: <Text style={{ fontWeight: '700' }}>"{w.incomingName}"</Text>
                          </Text>
                          <Text style={[styles.warningExisting, { color: theme.textSecondary }]}>
                            Existing {w.type}: <Text style={{ fontWeight: '600' }}>"{w.existingName}"</Text>
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.toggleActionBtn,
                            {
                              backgroundColor: isMerge ? theme.primary : theme.surfaceAlt,
                              borderColor: isMerge ? theme.primary : theme.border,
                            },
                          ]}
                          onPress={() => toggleWarningAction(w.id)}
                        >
                          <Text
                            style={[
                              styles.toggleActionBtnText,
                              { color: isMerge ? '#FFFFFF' : theme.text },
                            ]}
                          >
                            {isMerge ? 'Merge into Existing' : 'Keep Separate'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Price Conflicts */}
              {matchResult.priceConflicts.length > 0 && (
                <View
                  style={[
                    styles.sectionCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <Ionicons name="pricetag-outline" size={20} color={theme.primary} />
                    <Text style={[styles.sectionTitle, { color: theme.text, marginLeft: 6 }]}>
                      Price Updates Found ({matchResult.priceConflicts.length})
                    </Text>
                  </View>
                  <Text style={[styles.warningHelp, { color: theme.textSecondary }]}>
                    These items have a different price in the file. Choose which price to use:
                  </Text>

                  {matchResult.priceConflicts.map((p) => {
                    const choice = priceSelections[p.itemId] || 'old';
                    return (
                      <View
                        key={p.id}
                        style={[styles.conflictItem, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                      >
                        <View style={{ marginBottom: 6 }}>
                          <Text style={[styles.conflictName, { color: theme.text }]}>
                            {p.vendorName} • {p.itemName}
                          </Text>
                        </View>
                        <View style={styles.conflictChoicesRow}>
                          <TouchableOpacity
                            style={[
                              styles.priceChoiceBtn,
                              choice === 'old'
                                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                                : { backgroundColor: theme.surface, borderColor: theme.border },
                            ]}
                            onPress={() => setPriceChoice(p.itemId, 'old')}
                          >
                            <Text
                              style={[
                                styles.priceChoiceText,
                                { color: choice === 'old' ? '#FFFFFF' : theme.text },
                              ]}
                            >
                              Keep Old: {formatNaira(p.existingPrice)}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.priceChoiceBtn,
                              choice === 'new'
                                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                                : { backgroundColor: theme.surface, borderColor: theme.border },
                            ]}
                            onPress={() => setPriceChoice(p.itemId, 'new')}
                          >
                            <Text
                              style={[
                                styles.priceChoiceText,
                                { color: choice === 'new' ? '#FFFFFF' : theme.text },
                              ]}
                            >
                              Use New: {formatNaira(p.newPrice)}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Grouped Preview by Vendor */}
              <View style={[styles.sectionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>
                  Valid Rows to Import ({validRowCount})
                </Text>

                {matchResult.groupedByVendor.map((vg, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.vendorGroupCard,
                      { backgroundColor: theme.surfaceAlt, borderColor: theme.border },
                    ]}
                  >
                    <View style={styles.vendorGroupHeader}>
                      <Text style={[styles.vendorGroupTitle, { color: theme.text }]}>
                        {vg.vendorName}
                      </Text>
                      {vg.isNewVendor && (
                        <View style={[styles.newBadge, { backgroundColor: theme.successLight }]}>
                          <Text style={[styles.newBadgeText, { color: theme.success }]}>New Vendor</Text>
                        </View>
                      )}
                    </View>

                    {vg.items.map((it, itIdx) => (
                      <View
                        key={itIdx}
                        style={[
                          styles.previewItemRow,
                          { borderBottomColor: theme.divider },
                          itIdx === vg.items.length - 1 && { borderBottomWidth: 0 },
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.previewItemName, { color: theme.text }]}>{it.item}</Text>
                          <Text style={[styles.previewItemSub, { color: theme.textSecondary }]}>
                            {it.isNewItem ? 'New Item' : `Current Stock: ${it.currentStock}`} | Price:{' '}
                            {it.price !== null ? formatNaira(it.price) : 'Unchanged'}
                          </Text>
                          {it.internalDuplicates && it.internalDuplicates.length > 0 && (
                            <Text style={[styles.duplicateFlagText, { color: theme.warning }]}>
                              ⚠ Combined from {it.internalDuplicates.length + 1} duplicate rows in file
                            </Text>
                          )}
                        </View>
                        <View style={styles.qtyBox}>
                          <Text style={[styles.qtyLabel, { color: theme.textMuted }]}>Qty</Text>
                          <Text style={[styles.qtyValue, { color: theme.primary }]}>{it.quantity}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </View>

              {/* Skipped Rows Section */}
              {skippedCount > 0 && (
                <View
                  style={[
                    styles.sectionCard,
                    { backgroundColor: theme.dangerLight, borderColor: theme.danger },
                  ]}
                >
                  <View style={styles.cardHeaderRow}>
                    <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
                    <Text style={[styles.sectionTitle, { color: theme.danger, marginLeft: 6 }]}>
                      Skipped Rows ({skippedCount})
                    </Text>
                  </View>
                  <Text style={[styles.warningHelp, { color: theme.textSecondary }]}>
                    These rows were ignored because they did not pass validation:
                  </Text>

                  {parsedData.skippedRows.map((sr, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.skippedRowItem,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.skippedRowTitle, { color: theme.text }]}>
                          Row {sr.rowNumber}: "{sr.vendor || 'Unknown Vendor'}" — "{sr.item || 'Unknown Item'}"
                        </Text>
                        <Text style={[styles.skippedReason, { color: theme.danger }]}>
                          Reason: {sr.reason} (Quantity: {String(sr.quantity)})
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Footer Actions */}
        <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: theme.border }]}
            onPress={handleClose}
            disabled={saving}
          >
            <Text style={[styles.cancelBtnText, { color: theme.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.importBtn,
              { backgroundColor: theme.primary },
              (validRowCount === 0 || saving || parsing) && { backgroundColor: theme.border },
            ]}
            onPress={handleConfirmImport}
            disabled={validRowCount === 0 || saving || parsing}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                <Text style={styles.importBtnText}>
                  Import ({validRowCount} {validRowCount === 1 ? 'row' : 'rows'})
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 48 : SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl * 2,
    gap: SPACING.md,
  },
  pickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  pickerSub: {
    fontSize: 12,
  },
  chooseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  chooseBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  parsingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  parsingText: {
    fontSize: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statBadge: {
    flex: 1,
    minWidth: '45%',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  sectionCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  modeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    gap: 6,
  },
  modeOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modeExplanation: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    gap: SPACING.sm,
  },
  modeExplanationText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  warningHelp: {
    fontSize: 12,
    marginBottom: 4,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  warningIncoming: {
    fontSize: 13,
  },
  warningExisting: {
    fontSize: 12,
    marginTop: 2,
  },
  toggleActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  toggleActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  conflictItem: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  conflictName: {
    fontSize: 13,
    fontWeight: '700',
  },
  conflictChoicesRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  priceChoiceBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  priceChoiceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  vendorGroupCard: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  vendorGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
  },
  vendorGroupTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  newBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: RADIUS.sm,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  previewItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  previewItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  previewItemSub: {
    fontSize: 11,
    marginTop: 2,
  },
  duplicateFlagText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  qtyBox: {
    alignItems: 'flex-end',
    marginLeft: SPACING.sm,
  },
  qtyLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  skippedRowItem: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    marginBottom: 4,
  },
  skippedRowTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  skippedReason: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.md,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  importBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  importBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
