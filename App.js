import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, Alert, FlatList, Keyboard, Modal
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const VendorsContext = createContext();

// --- Modern Color Palette ---
const COLORS = {
  primary: '#6C63FF',       // Vivid indigo
  primaryDark: '#5A52D5',
  accent: '#00D4AA',        // Teal accent
  danger: '#FF4757',        // Soft red
  dangerLight: '#FFF0F0',
  success: '#2ED573',       // Green
  background: '#F0F2F5',    // Cool light gray
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FA',
  text: '#1A1D26',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  searchBg: '#ECEDF1',
  cardShadow: '#6C63FF',
  headerGradientStart: '#6C63FF',
  headerGradientEnd: '#A78BFA',
};

export const VendorsProvider = ({ children }) => {
  const [vendors, setVendors] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const storedVendors = await AsyncStorage.getItem('@vendors_data');
        if (storedVendors !== null) {
          setVendors(JSON.parse(storedVendors));
        }
      } catch (e) {
        console.error("Error loading vendors", e);
      }
      setIsLoaded(true);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const saveData = async () => {
        try {
          await AsyncStorage.setItem('@vendors_data', JSON.stringify(vendors));
        } catch (e) {
          console.error("Error saving vendors", e);
        }
      };
      saveData();
    }
  }, [vendors, isLoaded]);

  return (
    <VendorsContext.Provider value={{ vendors, setVendors }}>
      {children}
    </VendorsContext.Provider>
  );
};

const formatVendorStock = (vendor) => {
  if (vendor.items.length === 0) return `Vendor: ${vendor.name}\nNo items in stock.`;
  let text = `--- ${vendor.name.toUpperCase()} STOCK ---\n`;
  vendor.items.forEach(item => {
    const exp = item.expected === '' ? 0 : item.expected;
    text += `• ${item.name}: ${exp}\n`;
  });
  return text;
};

const HomeScreen = ({ navigation }) => {
  const { vendors, setVendors } = useContext(VendorsContext);
  const [newVendorName, setNewVendorName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const addVendor = () => {
    if (newVendorName.trim() === '') return;
    setVendors([...vendors, { id: Date.now().toString(), name: newVendorName.trim(), items: [] }]);
    setNewVendorName('');
    Keyboard.dismiss();
  };

  const copyGeneralStock = async () => {
    if (vendors.length === 0) {
      Alert.alert('No Data', 'There is no stock data to copy.');
      return;
    }
    let text = `=== GENERAL STOCK REPORT ===\n\n`;
    vendors.forEach(vendor => {
      text += formatVendorStock(vendor) + '\n';
    });
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', 'General stock report has been copied to clipboard.');
  };

  const clearSearch = () => {
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={copyGeneralStock} style={styles.headerButton}>
          <Ionicons name="copy-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, vendors]);

  // Assign a color from a preset palette to each vendor card
  const cardAccents = ['#6C63FF', '#00D4AA', '#FF6B6B', '#FFA502', '#1E90FF', '#FF6B81', '#7BED9F', '#70A1FF'];

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={COLORS.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search vendors..."
          placeholderTextColor={COLORS.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Add Vendor */}
      <View style={styles.addVendorContainer}>
        <View style={styles.inputWrapper}>
          <Ionicons name="storefront-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
          <TextInput
            style={styles.addVendorInput}
            placeholder="New vendor name"
            placeholderTextColor={COLORS.textMuted}
            value={newVendorName}
            onChangeText={setNewVendorName}
            onSubmitEditing={addVendor}
            returnKeyType="done"
          />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={addVendor} activeOpacity={0.8}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Vendors List */}
      <FlatList
        data={filteredVendors}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="folder-open-outline" size={56} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyStateTitle}>
              {searchQuery ? 'No vendors found' : 'No vendors yet'}
            </Text>
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'Try a different search term.' : 'Tap the + button to add your first vendor.'}
            </Text>
          </View>
        }
        renderItem={({ item: vendor, index }) => {
          const accentColor = cardAccents[index % cardAccents.length];
          return (
            <TouchableOpacity 
              style={styles.vendorCard} 
              onPress={() => navigation.navigate('Vendor', { vendorId: vendor.id, vendorName: vendor.name })}
              activeOpacity={0.7}
            >
              {/* Accent bar on top */}
              <View style={[styles.vendorCardAccent, { backgroundColor: accentColor }]} />
              <View style={styles.vendorCardBody}>
                <View style={[styles.vendorIconWrap, { backgroundColor: accentColor + '18' }]}>
                  <Ionicons name="cube-outline" size={28} color={accentColor} />
                </View>
                <Text style={styles.vendorName} numberOfLines={2}>{vendor.name}</Text>
                <View style={styles.vendorBadge}>
                  <Text style={styles.vendorBadgeText}>
                    {vendor.items.length} {vendor.items.length === 1 ? 'item' : 'items'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

const VendorScreen = ({ route, navigation }) => {
  const { vendorId } = route.params;
  const { vendors, setVendors } = useContext(VendorsContext);
  
  const vendor = vendors.find(v => v.id === vendorId);

  const [newItemName, setNewItemName] = useState('');
  const [newExpected, setNewExpected] = useState('');
  const [newActual, setNewActual] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState(null);
  const copyVendorStock = async () => {
    if (!vendor) return;
    const text = formatVendorStock(vendor);
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', `${vendor.name}'s stock has been copied to clipboard.`);
  };

  const deleteVendor = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteVendor = () => {
    setShowDeleteConfirm(false);
    setVendors(vendors.filter(v => v.id !== vendorId));
    navigation.goBack();
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity onPress={copyVendorStock} style={styles.headerButton}>
            <Ionicons name="copy-outline" size={22} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={deleteVendor} style={[styles.headerButton, { backgroundColor: 'rgba(255,71,87,0.25)' }]}>
            <Ionicons name="trash-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, vendor]);

  if (!vendor) return null;

  const addItem = () => {
    if (newItemName.trim() === '') {
      Alert.alert('Validation Error', 'Item name is required.');
      return;
    }

    const expected = parseInt(newExpected) || 0;
    const actual = parseInt(newActual) || 0;

    setVendors(vendors.map(v => {
      if (v.id === vendorId) {
        return {
          ...v,
          items: [...v.items, {
            id: Date.now().toString(),
            name: newItemName.trim(),
            expected,
            actual
          }]
        };
      }
      return v;
    }));

    setNewItemName('');
    setNewExpected('');
    setNewActual('');
  };

  const updateItem = (itemId, field, value) => {
    const numericValue = value === '' ? '' : parseInt(value, 10);
    if (isNaN(numericValue) && value !== '') return;

    setVendors(vendors.map(v => {
      if (v.id === vendorId) {
        return {
          ...v,
          items: v.items.map(item => {
            if (item.id === itemId) {
              return { ...item, [field]: numericValue };
            }
            return item;
          })
        };
      }
      return v;
    }));
  };

  const removeItem = (itemId) => {
    setDeleteItemId(itemId);
  };

  const confirmRemoveItem = () => {
    setVendors(vendors.map(v => {
      if (v.id === vendorId) {
        return { ...v, items: v.items.filter(i => i.id !== deleteItemId) };
      }
      return v;
    }));
    setDeleteItemId(null);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Add Item Row */}
      <View style={styles.addItemContainer}>
        <TextInput
          style={[styles.itemInput, {flex: 2}]}
          placeholder="Item Name"
          placeholderTextColor={COLORS.textMuted}
          value={newItemName}
          onChangeText={setNewItemName}
        />
        <TextInput
          style={[styles.itemInput, {flex: 1.2}]}
          placeholder="Exp."
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
          value={newExpected}
          onChangeText={setNewExpected}
        />
        <TextInput
          style={[styles.itemInput, {flex: 1.2}]}
          placeholder="Act."
          placeholderTextColor={COLORS.textMuted}
          keyboardType="numeric"
          value={newActual}
          onChangeText={setNewActual}
        />
        <TouchableOpacity style={styles.addSmallButton} onPress={addItem} activeOpacity={0.8}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Items List */}
      <View style={{flex: 1, paddingHorizontal: 20}}>
        {vendor.items.length > 0 && (
          <View style={styles.itemHeader}>
            <Text style={[styles.headerText, {flex: 2}]}>Item</Text>
            <Text style={[styles.headerText, {flex: 1.2, textAlign: 'center'}]}>Exp</Text>
            <Text style={[styles.headerText, {flex: 1.2, textAlign: 'center'}]}>Act</Text>
            <Text style={[styles.headerText, {flex: 1.2, textAlign: 'center'}]}>Miss</Text>
            <Text style={{width: 28}}></Text>
          </View>
        )}
        <FlatList
          data={vendor.items}
          keyExtractor={item => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="cube-outline" size={44} color={COLORS.primary} />
              </View>
              <Text style={styles.emptyStateTitle}>No items yet</Text>
              <Text style={styles.emptyStateText}>Add items using the form above.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const missing = (item.expected === '' ? 0 : item.expected) - (item.actual === '' ? 0 : item.actual);
            return (
              <View style={styles.itemRow}>
                <Text style={[styles.itemText, {flex: 2}]} numberOfLines={2}>{item.name}</Text>
                <View style={[styles.editableCell, {flex: 1.2}]}>
                  <TextInput
                    style={styles.cellInput}
                    keyboardType="numeric"
                    value={item.expected.toString()}
                    onChangeText={(text) => updateItem(item.id, 'expected', text)}
                  />
                </View>
                <View style={[styles.editableCell, {flex: 1.2}]}>
                  <TextInput
                    style={styles.cellInput}
                    keyboardType="numeric"
                    value={item.actual.toString()}
                    onChangeText={(text) => updateItem(item.id, 'actual', text)}
                  />
                </View>
                <View style={[styles.missingBadge, { backgroundColor: missing > 0 ? COLORS.dangerLight : '#E8FFF3' }]}>
                  <Text style={[styles.missingText, {flex: 1.2, color: missing > 0 ? COLORS.danger : COLORS.success}]}>
                    {item.expected === '' || item.actual === '' ? '-' : missing}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.deleteItemBtn}>
                  <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning-outline" size={36} color={COLORS.danger} />
            </View>
            <Text style={styles.modalTitle}>Delete Vendor</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete "{vendor.name}" and all its items? This cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDeleteConfirm(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteBtn}
                onPress={confirmDeleteVendor}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Item Delete Confirmation Modal */}
      <Modal
        visible={deleteItemId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteItemId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="warning-outline" size={36} color={COLORS.danger} />
            </View>
            <Text style={styles.modalTitle}>Delete Item</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete "{vendor.items.find(i => i.id === deleteItemId)?.name}"? This cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteItemId(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteBtn}
                onPress={confirmRemoveItem}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <VendorsProvider>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator 
            initialRouteName="Home"
            screenOptions={{
              headerStyle: { backgroundColor: COLORS.primary },
              headerTintColor: '#FFF',
              headerTitleStyle: { fontWeight: '700', fontSize: 18 },
              headerBackTitleVisible: false,
              headerShadowVisible: false,
            }}
          >
            <Stack.Screen 
              name="Home" 
              component={HomeScreen} 
              options={{ title: 'Stock Manager' }} 
            />
            <Stack.Screen 
              name="Vendor" 
              component={VendorScreen} 
              options={({ route }) => ({ title: route.params.vendorName })} 
            />
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </VendorsProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // --- Header Buttons ---
  headerButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  // --- Search ---
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.searchBg,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 0,
    borderRadius: 14,
    paddingHorizontal: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },
  clearButton: {
    padding: 4,
  },
  // --- Add Vendor ---
  addVendorContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  addVendorInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  // --- Empty State ---
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  // --- Vendor Cards ---
  row: {
    justifyContent: 'space-between',
  },
  vendorCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 14,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    maxWidth: '48%',
  },
  vendorCardAccent: {
    height: 4,
    width: '100%',
  },
  vendorCardBody: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 130,
  },
  vendorIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  vendorName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  vendorBadge: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  vendorBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  // --- Vendor Screen: Add Item ---
  addItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemInput: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    fontSize: 14,
    color: COLORS.text,
  },
  addSmallButton: {
    backgroundColor: COLORS.accent,
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  // --- Item List ---
  itemHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
    marginBottom: 6,
    marginTop: 8,
  },
  headerText: {
    fontWeight: '700',
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  itemText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    paddingRight: 6,
  },
  editableCell: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cellInput: {
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  missingBadge: {
    flex: 1.2,
    borderRadius: 8,
    paddingVertical: 6,
    marginHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingText: {
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 15,
  },
  deleteItemBtn: {
    width: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  // --- Delete Confirmation Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  modalDeleteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
