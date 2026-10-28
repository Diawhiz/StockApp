import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { SPACING, RADIUS } from '../../styles/theme';

export function Card({ children, style }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: theme.cardShadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Badge({ label, variant = 'primary', style }) {
  const { theme } = useTheme();

  const variantStyles = {
    primary: { bg: theme.primaryLight, color: theme.primary },
    success: { bg: theme.successLight, color: theme.success },
    warning: { bg: theme.warningLight, color: theme.warning },
    danger: { bg: theme.dangerLight, color: theme.danger },
    neutral: { bg: theme.badgeBg, color: theme.textSecondary },
  };

  const current = variantStyles[variant] || variantStyles.primary;

  return (
    <View style={[styles.badge, { backgroundColor: current.bg }, style]}>
      <Text style={[styles.badgeText, { color: current.color }]}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  style,
  textStyle,
}) {
  const { theme } = useTheme();

  let bg = theme.primary;
  let textColor = '#FFFFFF';
  let border = 'transparent';

  if (variant === 'secondary') {
    bg = theme.surfaceAlt;
    textColor = theme.text;
    border = theme.border;
  } else if (variant === 'danger') {
    bg = theme.danger;
    textColor = '#FFFFFF';
  } else if (variant === 'outline') {
    bg = 'transparent';
    textColor = theme.primary;
    border = theme.primary;
  } else if (variant === 'ghost') {
    bg = 'transparent';
    textColor = theme.textSecondary;
  }

  if (disabled) {
    bg = theme.border;
    textColor = theme.textMuted;
    border = 'transparent';
  }

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: bg, borderColor: border, borderWidth: border !== 'transparent' ? 1.5 : 0 },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <View style={styles.btnContent}>
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color={textColor}
              style={{ marginRight: 6 }}
            />
          )}
          <Text style={[styles.btnText, { color: textColor }, textStyle]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  prefix,
  keyboardType = 'default',
  error,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  style,
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.inputGroup, style]}>
      {label && <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: disabled ? theme.surfaceAlt : theme.inputBg,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}
      >
        {prefix && (
          <Text style={[styles.prefix, { color: theme.textMuted }]}>{prefix}</Text>
        )}
        <TextInput
          style={[
            styles.textInput,
            { color: disabled ? theme.textMuted : theme.text },
            multiline && { height: numberOfLines * 24 + 16, textAlignVertical: 'top' },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          keyboardType={keyboardType}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
      </View>
      {error && <Text style={[styles.fieldError, { color: theme.danger }]}>{error}</Text>}
    </View>
  );
}

export function EmptyState({ icon = 'cube-outline', message }) {
  const { theme } = useTheme();
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={42} color={theme.textMuted} style={{ marginBottom: 8 }} />
      <Text style={[styles.emptyText, { color: theme.textMuted }]}>{message}</Text>
    </View>
  );
}

export function LoadingSpinner({ text = 'Loading...' }) {
  const { theme } = useTheme();
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: SPACING.sm,
  },
  fieldError: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  loadingContainer: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: SPACING.sm,
    fontSize: 14,
    fontWeight: '500',
  },
});
