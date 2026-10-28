import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  TouchableWithoutFeedback,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

export function SearchableSelect({
  label,
  placeholder = 'Select option...',
  options = [], // [{ label: string, value: string, subtitle?: string }]
  selectedValue,
  onSelect,
  onOtherPress,
  onClear,
  disabled = false,
  error,
  style,
}) {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [query, setQuery] = useState('');

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === selectedValue),
    [options, selectedValue]
  );

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const lower = query.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(lower) ||
        (opt.subtitle && opt.subtitle.toLowerCase().includes(lower))
    );
  }, [options, query]);

  const handleOpen = () => {
    if (disabled) return;
    setQuery('');
    setModalVisible(true);
  };

  const handleSelect = (item) => {
    onSelect(item.value, item);
    setModalVisible(false);
  };

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>}
      <TouchableOpacity
        style={[
          styles.selector,
          {
            backgroundColor: disabled ? theme.surfaceAlt : theme.inputBg,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}
        onPress={handleOpen}
        disabled={disabled}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.selectorText,
            {
              color: selectedOption ? theme.text : theme.textMuted,
            },
          ]}
          numberOfLines={1}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={disabled ? theme.textMuted : theme.textSecondary}
        />
        {onClear && selectedValue ? (
          <TouchableOpacity
            onPress={onClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginLeft: 6 }}
          >
            <Ionicons name="close-circle" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
      {error && <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>}

      {/* Picker Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <SafeAreaView style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
                {/* Header */}
                <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>
                    {label ? `Select ${label}` : 'Select Option'}
                  </Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={24} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Search Input */}
                <View style={[styles.searchBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <Ionicons name="search" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.searchInput, { color: theme.text }]}
                    placeholder="Type to filter..."
                    placeholderTextColor={theme.textMuted}
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                  />
                  {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')}>
                      <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Options List */}
                <FlatList
                  data={filteredOptions}
                  keyExtractor={(item) => String(item.value)}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl }}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                        No matching options found
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isSelected = item.value === selectedValue;
                    return (
                      <TouchableOpacity
                        style={[
                          styles.optionItem,
                          {
                            borderBottomColor: theme.border,
                            backgroundColor: isSelected ? theme.primaryLight : 'transparent',
                          },
                        ]}
                        onPress={() => handleSelect(item)}
                      >
                        <View style={{ flex: 1, paddingRight: 10 }}>
                          <Text
                            style={[
                              styles.optionLabel,
                              {
                                color: isSelected ? theme.primary : theme.text,
                                fontWeight: isSelected ? '700' : '500',
                              },
                            ]}
                          >
                            {item.label}
                          </Text>
                          {item.subtitle ? (
                            <Text style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                  ListFooterComponent={
                    onOtherPress && modalVisible ? (
                      <TouchableOpacity
                        style={[styles.optionItem, { borderBottomColor: theme.border }]}
                        onPress={() => {
                          setModalVisible(false);
                          onOtherPress();
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="create-outline" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
                          <Text style={[styles.optionLabel, { color: theme.textSecondary }]}>
                            Other — type manually
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : null
                  }
                />
              </SafeAreaView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  selectorText: {
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '80%',
    minHeight: '40%',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginHorizontal: SPACING.lg,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: RADIUS.sm,
  },
  optionLabel: {
    fontSize: 15,
  },
  optionSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
});
