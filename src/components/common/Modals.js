import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAlert } from '../../context/AlertContext';
import { useTheme } from '../../context/ThemeContext';
import { RADIUS, SPACING } from '../../styles/theme';

export function GlobalModals() {
  const { toast, alertState, confirmState, promptState } = useAlert();
  const { theme } = useTheme();

  return (
    <>
      {toast && <ToastView toast={toast} theme={theme} />}
      {alertState && <AlertModalView alertState={alertState} theme={theme} />}
      {confirmState && <ConfirmModalView confirmState={confirmState} theme={theme} />}
      {promptState && <InputModalView promptState={promptState} theme={theme} />}
    </>
  );
}

function ToastView({ toast, theme }) {
  const isError = toast.variant === 'error';
  const isWarning = toast.variant === 'warning';
  const bg = isError ? theme.danger : isWarning ? theme.warning : theme.success;
  const icon = isError ? 'alert-circle' : isWarning ? 'warning' : 'checkmark-circle';

  return (
    <View style={styles.toastContainer} pointerEvents="none">
      <View style={[styles.toastCard, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={20} color="#FFFFFF" style={styles.toastIcon} />
        <Text style={styles.toastText}>{toast.message}</Text>
      </View>
    </View>
  );
}

function AlertModalView({ alertState, theme }) {
  const { title, message, variant, onClose } = alertState;
  const iconMap = {
    error: { name: 'close-circle', color: theme.danger },
    warning: { name: 'warning', color: theme.warning },
    success: { name: 'checkmark-circle', color: theme.success },
    info: { name: 'information-circle', color: theme.primary },
  };
  const icon = iconMap[variant] || iconMap.info;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalBox, { backgroundColor: theme.surface }]}>
              <View style={styles.modalHeader}>
                <Ionicons name={icon.name} size={28} color={icon.color} style={{ marginRight: 8 }} />
                <Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>
              </View>
              <Text style={[styles.modalMessage, { color: theme.textSecondary }]}>{message}</Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.btnTextWhite}>OK</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function ConfirmModalView({ confirmState, theme }) {
  const { title, message, confirmText, cancelText, isDestructive, onConfirm, onCancel } = confirmState;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.modalBox, { backgroundColor: theme.surface }]}>
              <View style={styles.modalHeader}>
                <Ionicons
                  name={isDestructive ? 'trash' : 'help-circle'}
                  size={26}
                  color={isDestructive ? theme.danger : theme.warning}
                  style={{ marginRight: 8 }}
                />
                <Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>
              </View>
              <Text style={[styles.modalMessage, { color: theme.textSecondary }]}>{message}</Text>
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: theme.border }]}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.btnTextSecondary, { color: theme.textSecondary }]}>{cancelText}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    { backgroundColor: isDestructive ? theme.danger : theme.primary },
                  ]}
                  onPress={onConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnTextWhite}>{confirmText}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function InputModalView({ promptState, theme }) {
  const {
    title,
    message,
    initialValue,
    placeholder,
    keyboardType,
    confirmText,
    cancelText,
    validate,
    onConfirm,
    onCancel,
  } = promptState;

  const [value, setValue] = useState(initialValue || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setValue(initialValue || '');
    setError('');
  }, [initialValue]);

  const handleSave = () => {
    if (validate) {
      const err = validate(value);
      if (err) {
        setError(err);
        return;
      }
    }
    onConfirm(value);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <TouchableWithoutFeedback onPress={onCancel}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <View style={[styles.modalBox, { backgroundColor: theme.surface }]}>
          <Text style={[styles.modalTitle, { color: theme.text, marginBottom: 6 }]}>{title}</Text>
          {message ? (
            <Text style={[styles.modalMessage, { color: theme.textSecondary, marginBottom: 12 }]}>
              {message}
            </Text>
          ) : null}

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                borderColor: error ? theme.danger : theme.borderStrong,
                color: theme.text,
              },
            ]}
            value={value}
            onChangeText={(txt) => {
              setValue(txt);
              if (error) setError('');
            }}
            placeholder={placeholder}
            placeholderTextColor={theme.textMuted}
            keyboardType={keyboardType}
            autoFocus
            selectTextOnFocus
          />

          {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: theme.border }]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnTextSecondary, { color: theme.textSecondary }]}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={styles.btnTextWhite}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  modalBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.xl,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: RADIUS.md,
    minWidth: 90,
    alignItems: 'center',
  },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  btnTextWhite: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  btnTextSecondary: {
    fontWeight: '600',
    fontSize: 15,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 13,
    marginTop: 6,
    fontWeight: '500',
  },
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: RADIUS.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  toastIcon: {
    marginRight: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
