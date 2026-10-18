import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../common/Header';
import { DailyOperationsScreen } from '../../screens/DailyOperationsScreen';
import { InventoryScreen } from '../../screens/InventoryScreen';
import { SummaryReportScreen } from '../../screens/SummaryReportScreen';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

export function MainLayout() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('operations'); // 'operations' | 'inventory' | 'summary'

  const tabs = [
    {
      id: 'operations',
      label: 'Operations',
      fullLabel: 'Daily Operations',
      icon: 'bicycle-outline',
      activeIcon: 'bicycle',
    },
    {
      id: 'inventory',
      label: 'Inventory',
      fullLabel: 'Inventory',
      icon: 'cube-outline',
      activeIcon: 'cube',
    },
    {
      id: 'summary',
      label: 'Summary & Report',
      fullLabel: 'Summary & Report',
      icon: 'receipt-outline',
      activeIcon: 'receipt',
    },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.headerBg }]}>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Global Persistent Header with Date Navigator & Theme Toggle */}
        <Header />

        {/* Active Screen Content */}
        <View style={styles.screenContainer}>
          {activeTab === 'operations' && <DailyOperationsScreen />}
          {activeTab === 'inventory' && <InventoryScreen />}
          {activeTab === 'summary' && <SummaryReportScreen />}
        </View>

        {/* Bottom Tab Bar */}
        <View style={[styles.tabBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabItem,
                  isActive && {
                    backgroundColor: theme.primaryLight,
                    borderRadius: RADIUS.md,
                  },
                ]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isActive ? tab.activeIcon : tab.icon}
                  size={20}
                  color={isActive ? theme.primary : theme.textMuted}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive ? theme.primary : theme.textMuted,
                      fontWeight: isActive ? '700' : '500',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    minHeight: 58,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginHorizontal: 4,
    gap: 3,
  },
  tabLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
});
