import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useDate } from '../../context/DateContext';
import { formatDisplayDate } from '../../utils/dateUtils';
import { SPACING, RADIUS } from '../../styles/theme';

export function Header() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { selectedDate, goToPrevDay, goToNextDay, goToToday } = useDate();

  return (
    <View style={[styles.container, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
      {/* Top Bar: Brand, Logo Image, and Theme Toggle */}
      <View style={styles.topRow}>
        <View style={styles.brandContainer}>
          {/* Logo from assets */}
          <View style={[styles.logoContainer, { borderColor: theme.border }]}>
            <Image
              source={require('../../../assets/sage-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.appTitle, { color: theme.text }]} numberOfLines={1}>
              Reporting & Inventory System
            </Text>
            <Text style={[styles.appSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
              Sage Logistics · Daily Reconciliation System
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.themeBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
          onPress={toggleTheme}
          activeOpacity={0.7}
          accessibilityLabel="Toggle Theme"
        >
          <Ionicons
            name={isDark ? 'sunny' : 'moon'}
            size={18}
            color={isDark ? theme.warning : theme.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Date Navigator Bar */}
      <View style={[styles.dateBar, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.dateNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={goToPrevDay}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={16} color={theme.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateDisplay}
          onPress={goToToday}
          activeOpacity={0.7}
        >
          <Text style={[styles.dateText, { color: theme.text }]}>
            {formatDisplayDate(selectedDate)}
          </Text>
          <Text style={[styles.todayHint, { color: theme.primary, backgroundColor: theme.primaryLight }]}>Today</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dateNavBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={goToNextDay}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  logoImage: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  appSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  themeBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginVertical: 4,
  },
  dateNavBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  todayHint: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
});
