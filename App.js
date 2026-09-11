import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, Alert, FlatList
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const VendorsContext = createContext();

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
  };

  const removeVendor = (vendorId) => {
    Alert.alert("Remove Vendor", "Are you sure you want to delete this vendor and all its items?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => setVendors(vendors.filter(v => v.id !== vendorId)) }
    ]);
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

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={copyGeneralStock} style={{ marginRight: 10 }}>
          <Ionicons name="copy-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, vendors]);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search vendors..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Add Vendor */}
      <View style={styles.addVendorContainer}>
        <View style={styles.inputWrapper}>
          <Ionicons name="business-outline" size={20} color="#666" style={styles.inputIcon} />
          <TextInput
            style={styles.addVendorInput}
            placeholder="New Vendor Name"
            placeholderTextColor="#999"
            value={newVendorName}
            onChangeText={setNewVendorName}
          />
        </View>
        <TouchableOpacity style={styles.primaryButton} onPress={addVendor}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Vendors List */}
      <FlatList
        data={filteredVendors}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={{ paddingHorizontal: 15, paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={60} color="#ccc" />
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'No vendors found.' : 'No vendors added yet.'}
            </Text>
          </View>
        }
        renderItem={({ item: vendor }) => (
          <TouchableOpacity 
            style={styles.vendorCard} 
            onPress={() => navigation.navigate('Vendor', { vendorId: vendor.id, vendorName: vendor.name })}
          >
            <View style={styles.vendorCardHeader}>
              <Text style={styles.vendorName} numberOfLines={1}>{vendor.name}</Text>
            </View>
            <View style={styles.vendorCardContent}>
              <Ionicons name="cube-outline" size={32} color="#007AFF" style={{ marginBottom: 10 }} />
              <Text style={styles.vendorSubtext}>
                {vendor.items.length} {vendor.items.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => removeVendor(vendor.id)} style={styles.deleteVendorBtn}>
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
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

  const copyVendorStock = async () => {
    if (!vendor) return;
    const text = formatVendorStock(vendor);
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied!', `${vendor.name}'s stock has been copied to clipboard.`);
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={copyVendorStock} style={{ marginRight: 10 }}>
          <Ionicons name="copy-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, vendor]);

  if (!vendor) return null; // Or return loading view if vendor just deleted and navigating back

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
    setVendors(vendors.map(v => {
      if (v.id === vendorId) {
        return { ...v, items: v.items.filter(i => i.id !== itemId) };
      }
      return v;
    }));
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.addItemContainer}>
        <TextInput
          style={[styles.itemInput, {flex: 2}]}
          placeholder="Item Name"
          placeholderTextColor="#aaa"
          value={newItemName}
          onChangeText={setNewItemName}
        />
        <TextInput
          style={[styles.itemInput, {flex: 1.2}]}
          placeholder="Exp."
          placeholderTextColor="#aaa"
          keyboardType="numeric"
          value={newExpected}
          onChangeText={setNewExpected}
        />
        <TextInput
          style={[styles.itemInput, {flex: 1.2}]}
          placeholder="Act."
          placeholderTextColor="#aaa"
          keyboardType="numeric"
          value={newActual}
          onChangeText={setNewActual}
        />
        <TouchableOpacity style={styles.addSmallButton} onPress={addItem}>
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={40} color="#ccc" />
              <Text style={styles.emptyStateText}>No items added yet.</Text>
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
                <Text style={[styles.missingText, {flex: 1.2, color: missing > 0 ? '#FF3B30' : '#34C759'}]}>
                  {item.expected === '' || item.actual === '' ? '-' : missing}
                </Text>
                <TouchableOpacity onPress={() => removeItem(item.id)} style={styles.deleteItemBtn}>
                  <Ionicons name="close-circle" size={20} color="#ccc" />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </View>
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
              headerStyle: { backgroundColor: '#007AFF' },
              headerTintColor: '#FFF',
              headerTitleStyle: { fontWeight: '700' },
              headerBackTitleVisible: false,
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
    backgroundColor: '#F2F2F7',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E5EA',
    margin: 20,
    marginBottom: 0,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  addVendorContainer: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 8,
  },
  addVendorInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  emptyStateText: {
    marginTop: 10,
    fontSize: 16,
    color: '#8E8E93',
  },
  row: {
    justifyContent: 'space-between',
  },
  vendorCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 130,
    maxWidth: '48%',
  },
  vendorCardHeader: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  vendorCardContent: {
    alignItems: 'center',
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  vendorSubtext: {
    fontSize: 14,
    color: '#8E8E93',
  },
  deleteVendorBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    backgroundColor: '#FFF2F2',
    borderRadius: 12,
  },
  addItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 6,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    marginBottom: 10,
  },
  itemInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
    fontSize: 14,
  },
  addSmallButton: {
    backgroundColor: '#34C759',
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingBottom: 8,
    marginBottom: 10,
  },
  headerText: {
    fontWeight: '600',
    fontSize: 12,
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  itemText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    paddingRight: 5,
  },
  editableCell: {
    backgroundColor: '#F2F2F7',
    borderRadius: 6,
    marginHorizontal: 2,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  cellInput: {
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  missingText: {
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 16,
  },
  deleteItemBtn: {
    width: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
  }
});
