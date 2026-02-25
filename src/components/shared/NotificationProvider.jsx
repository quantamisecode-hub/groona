import React, { createContext, useContext, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';

const NotificationContext = createContext(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

/**
 * Centralized Notification Provider
 * Handles all success, error, warning, and info messages across the application
 */
export default function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  /**
   * Display success notification
   * @param {string} message - Success message to display
   * @param {object} options - Additional toast options
   */
  const success = useCallback((message, options = {}) => {
    toast.success(message, {
      icon: <CheckCircle2 className="h-5 w-5" />,
      duration: 4000,
      ...options,
    });
    
    addToHistory('success', message);
  }, []);

  /**
   * Display error notification
   * @param {string|Error} error - Error message or Error object
   * @param {object} options - Additional toast options
   */
  const error = useCallback((error, options = {}) => {
    const message = typeof error === 'string' 
      ? error 
      : error?.message || 'An unexpected error occurred';
    
    toast.error(message, {
      icon: <XCircle className="h-5 w-5" />,
      duration: 6000,
      ...options,
    });
    
    addToHistory('error', message);
    
    // Log to console for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('[Notification Error]:', error);
    }
  }, []);

  /**
   * Display warning notification
   * @param {string} message - Warning message to display
   * @param {object} options - Additional toast options
   */
  const warning = useCallback((message, options = {}) => {
    toast.warning(message, {
      icon: <AlertCircle className="h-5 w-5" />,
      duration: 5000,
      ...options,
    });
    
    addToHistory('warning', message);
  }, []);

  /**
   * Display info notification
   * @param {string} message - Info message to display
   * @param {object} options - Additional toast options
   */
  const info = useCallback((message, options = {}) => {
    toast.info(message, {
      icon: <Info className="h-5 w-5" />,
      duration: 4000,
      ...options,
    });
    
    addToHistory('info', message);
  }, []);

  /**
   * Display loading notification with promise handling
   * @param {Promise} promise - Promise to track
   * @param {object} messages - Messages for loading, success, and error states
   */
  const promise = useCallback((promise, messages = {}) => {
    const defaults = {
      loading: 'Loading...',
      success: 'Operation completed successfully',
      error: 'Operation failed',
    };

    return toast.promise(promise, {
      loading: messages.loading || defaults.loading,
      success: messages.success || defaults.success,
      error: (err) => messages.error || err?.message || defaults.error,
    });
  }, []);

  /**
   * Add notification to history (for in-app notification center)
   */
  const addToHistory = useCallback((type, message) => {
    const notification = {
      id: Date.now() + Math.random(),
      type,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    };
    
    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
  }, []);

  /**
   * Mark notification as read
   */
  const markAsRead = useCallback((id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  /**
   * Clear all notifications
   */
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const value = {
    success,
    error,
    warning,
    info,
    promise,
    notifications,
    markAsRead,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}