import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';

interface PendingSelectionsMap {
  [key: string]: unknown;
}

interface PendingSelectionContextValue {
  activeKey: string | null;
  pendingSelections: PendingSelectionsMap;
  beginSelection: (key: string) => void;
  completeSelection: (value: unknown) => void;
  consumeSelection: <T = unknown>(key: string) => T | undefined;
}

const PendingSelectionContext = createContext<PendingSelectionContextValue>({
  activeKey: null,
  pendingSelections: {},
  beginSelection: () => {},
  completeSelection: () => {},
  consumeSelection: () => undefined,
});

export const PendingSelectionProvider = ({ children }: { children: ReactNode }) => {
  const [activeKeyState, setActiveKeyState] = useState<string | null>(null);
  const activeKeyRef = useRef<string | null>(null);
  const [pendingSelections, setPendingSelections] = useState<PendingSelectionsMap>({});

  const setActiveKey = useCallback((key: string | null) => {
    activeKeyRef.current = key;
    setActiveKeyState(key);
  }, []);

  const beginSelection = useCallback(
    (key: string) => {
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

  const consumeSelection = useCallback(<T,>(key: string): T | undefined => {
    let consumedValue: unknown | undefined;
    setPendingSelections(prev => {
      if (!(key in prev)) {
        return prev;
      }
      const { [key]: value, ...rest } = prev;
      consumedValue = value;
      return rest;
    });
    return consumedValue as T | undefined;
  }, []);

  const value = useMemo(
    () => ({
      activeKey: activeKeyState,
      pendingSelections,
      beginSelection,
      completeSelection,
      consumeSelection,
    }),
    [activeKeyState, pendingSelections, beginSelection, completeSelection, consumeSelection]
  );

  return (
    <PendingSelectionContext.Provider value={value}>
      {children}
    </PendingSelectionContext.Provider>
  );
};

export const usePendingSelection = () => useContext(PendingSelectionContext);
