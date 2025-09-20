import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import type { SelectionKey } from '@/constants/selectionKeys';

type PendingSelectionsMap = Partial<Record<SelectionKey, unknown>>;

interface PendingSelectionContextValue {
  activeKey: SelectionKey | null;
  pendingSelections: PendingSelectionsMap;
  beginSelection: (key: SelectionKey) => void;
  completeSelection: (value: unknown) => void;
  consumeSelection: <T = unknown>(key: SelectionKey) => T | undefined;
  cancelSelection: () => void;
}

const PendingSelectionContext = createContext<PendingSelectionContextValue>({
  activeKey: null,
  pendingSelections: {},
  beginSelection: () => {},
  completeSelection: () => {},
  consumeSelection: () => undefined,
  cancelSelection: () => {},
});

export const PendingSelectionProvider = ({ children }: { children: ReactNode }) => {
  const [activeKeyState, setActiveKeyState] = useState<SelectionKey | null>(null);
  const activeKeyRef = useRef<SelectionKey | null>(null);
  const [pendingSelections, setPendingSelections] = useState<PendingSelectionsMap>({});

  const setActiveKey = useCallback((key: SelectionKey | null) => {
    activeKeyRef.current = key;
    setActiveKeyState(key);
  }, []);

  const beginSelection = useCallback(
    (key: SelectionKey) => {
      setActiveKey(key);
    },
    [setActiveKey]
  );

  const completeSelection = useCallback(
    (value: unknown) => {
      setPendingSelections(prev => {
        const key = activeKeyRef.current;
        if (!key) {
          return prev;
        }
        return { ...prev, [key]: value };
      });
      setActiveKey(null);
    },
    [setActiveKey]
  );

  const consumeSelection = useCallback(
    <T,>(key: SelectionKey): T | undefined => {
      if (!(key in pendingSelections)) {
        return undefined;
      }
      const value = pendingSelections[key] as T | undefined;
      setPendingSelections(prev => {
        if (!(key in prev)) {
          return prev;
        }
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      return value;
    },
    [pendingSelections]
  );

  const cancelSelection = useCallback(() => {
    setActiveKey(null);
  }, [setActiveKey]);

  const value = useMemo(
    () => ({
      activeKey: activeKeyState,
      pendingSelections,
      beginSelection,
      completeSelection,
      consumeSelection,
      cancelSelection,
    }),
    [activeKeyState, pendingSelections, beginSelection, completeSelection, consumeSelection, cancelSelection]
  );

  return (
    <PendingSelectionContext.Provider value={value}>
      {children}
    </PendingSelectionContext.Provider>
  );
};

export const usePendingSelection = () => useContext(PendingSelectionContext);
