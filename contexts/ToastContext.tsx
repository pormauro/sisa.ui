import React, {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';

interface ToastState {
  id: number;
  message: string;
  duration: number;
}

export interface ToastOptions {
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION = 3000;

export const ToastProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const backgroundColor = useThemeColor(
    { light: 'rgba(17, 24, 39, 0.95)', dark: 'rgba(249, 250, 251, 0.92)' },
    'background'
  );
  const textColor = useThemeColor({ light: '#f9fafb', dark: '#111827' }, 'text');

  const clearScheduledHide = useCallback(() => {
    if (hideTimeout.current !== null) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    clearScheduledHide();

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 16,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [clearScheduledHide, opacity, translateY]);

  const showToast = useCallback(
    (message: string, options?: ToastOptions) => {
      if (!message) {
        return;
      }

      clearScheduledHide();

      opacity.stopAnimation();
      translateY.stopAnimation();
      opacity.setValue(0);
      translateY.setValue(16);

      const duration = options?.duration ?? DEFAULT_DURATION;
      setToast({
        id: Date.now(),
        message,
        duration,
      });
    },
    [clearScheduledHide, opacity, translateY]
  );

  React.useEffect(() => {
    if (!toast) {
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    hideTimeout.current = setTimeout(() => {
      hideToast();
    }, toast.duration);

    return () => {
      clearScheduledHide();
    };
  }, [toast, clearScheduledHide, hideToast, opacity, translateY]);

  React.useEffect(() => () => {
    clearScheduledHide();
  }, [clearScheduledHide]);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View pointerEvents="none" style={styles.host}>
        {toast ? (
          <Animated.View
            style={[
              styles.toast,
              {
                opacity,
                transform: [{ translateY }],
                backgroundColor,
              },
            ]}
          >
            <Text style={[styles.text, { color: textColor }]}>{toast.message}</Text>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  toast: {
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
