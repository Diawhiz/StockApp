import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const AlertContext = createContext();

export function AlertProvider({ children }) {
  // Toast state
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  // Alert modal state
  const [alertState, setAlertState] = useState(null);

  // Confirm modal state
  const [confirmState, setConfirmState] = useState(null);

  // Input / Prompt modal state
  const [promptState, setPromptState] = useState(null);

  const showToast = useCallback((message, variant = 'success', duration = 2500) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, variant });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, duration);
  }, []);

  const hideToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast(null);
  }, []);

  const showAlert = useCallback(({ title = 'Notice', message, variant = 'info' }) => {
    return new Promise((resolve) => {
      setAlertState({
        title,
        message,
        variant,
        onClose: () => {
          setAlertState(null);
          resolve();
        },
      });
    });
  }, []);

  const showConfirm = useCallback(
    ({
      title = 'Confirm',
      message = 'Are you sure you want to proceed?',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      isDestructive = true,
    }) => {
      return new Promise((resolve) => {
        setConfirmState({
          title,
          message,
          confirmText,
          cancelText,
          isDestructive,
          onConfirm: () => {
            setConfirmState(null);
            resolve(true);
          },
          onCancel: () => {
            setConfirmState(null);
            resolve(false);
          },
        });
      });
    },
    []
  );

  const showPrompt = useCallback(
    ({
      title = 'Edit',
      message = '',
      initialValue = '',
      placeholder = '',
      keyboardType = 'default',
      confirmText = 'Save',
      cancelText = 'Cancel',
      validate = null,
    }) => {
      return new Promise((resolve) => {
        setPromptState({
          title,
          message,
          initialValue: String(initialValue),
          placeholder,
          keyboardType,
          confirmText,
          cancelText,
          validate,
          onConfirm: (val) => {
            setPromptState(null);
            resolve(val);
          },
          onCancel: () => {
            setPromptState(null);
            resolve(null);
          },
        });
      });
    },
    []
  );

  return (
    <AlertContext.Provider
      value={{
        toast,
        showToast,
        hideToast,
        alertState,
        showAlert,
        confirmState,
        showConfirm,
        promptState,
        showPrompt,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
