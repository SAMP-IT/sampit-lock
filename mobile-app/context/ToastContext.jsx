import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from '../components/ui/Toast';

const ToastContext = createContext({
  showToast: () => {},
  showSuccess: () => {},
  showError: () => {},
  showWarning: () => {},
  showInfo: () => {},
  hideToast: () => {},
});

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info',
    duration: 3000,
    action: null,
    actionLabel: null,
  });

  const queueRef = useRef([]);
  const isShowingRef = useRef(false);

  const processQueue = useCallback(() => {
    if (queueRef.current.length > 0 && !isShowingRef.current) {
      isShowingRef.current = true;
      const nextToast = queueRef.current.shift();
      setToast({ ...nextToast, visible: true });
    }
  }, []);

  const showToast = useCallback(({ message, type = 'info', duration = 3000, action = null, actionLabel = null }) => {
    const toastConfig = {
      message,
      type,
      duration,
      action,
      actionLabel,
    };

    if (isShowingRef.current) {
      // Queue the toast
      queueRef.current.push(toastConfig);
    } else {
      isShowingRef.current = true;
      setToast({ ...toastConfig, visible: true });
    }
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
    isShowingRef.current = false;

    // Process next toast in queue
    setTimeout(processQueue, 300);
  }, [processQueue]);

  const showSuccess = useCallback((message, options = {}) => {
    showToast({ message, type: 'success', ...options });
  }, [showToast]);

  const showError = useCallback((message, options = {}) => {
    showToast({ message, type: 'error', duration: 5000, ...options });
  }, [showToast]);

  const showWarning = useCallback((message, options = {}) => {
    showToast({ message, type: 'warning', duration: 4000, ...options });
  }, [showToast]);

  const showInfo = useCallback((message, options = {}) => {
    showToast({ message, type: 'info', ...options });
  }, [showToast]);

  return (
    <ToastContext.Provider value={{
      showToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      hideToast,
    }}>
      {children}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={toast.duration}
        action={toast.action}
        actionLabel={toast.actionLabel}
        onDismiss={hideToast}
      />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    console.warn('useToast must be used within a ToastProvider');
    return {
      showToast: () => {},
      showSuccess: () => {},
      showError: () => {},
      showWarning: () => {},
      showInfo: () => {},
      hideToast: () => {},
    };
  }
  return context;
};

// Singleton toast manager for use outside React components (e.g., API interceptors)
let toastManager = {
  showToast: () => console.warn('ToastManager not initialized'),
  showSuccess: () => console.warn('ToastManager not initialized'),
  showError: () => console.warn('ToastManager not initialized'),
  showWarning: () => console.warn('ToastManager not initialized'),
  showInfo: () => console.warn('ToastManager not initialized'),
};

export const setToastManager = (manager) => {
  toastManager = manager;
};

export const getToastManager = () => toastManager;

export default ToastContext;
