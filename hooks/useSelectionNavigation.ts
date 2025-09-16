import { useCallback, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  buildSelectionPath,
  CLEAR_SELECTION_VALUE,
  getSingleParamValue,
} from '@/utils/selection';

type SelectionExtraParams = Record<string, string | number | boolean | null | undefined>;

interface UseSelectionNavigationOptions {
  selectionPath: string;
  paramName: string;
  returnPath: string;
  currentValue?: string | number | null;
  onSelection: (value: string | null) => void;
  stayOnSelect?: boolean;
  extraParams?: SelectionExtraParams;
}

interface UseSelectionNavigationResult {
  openSelector: () => void;
  clearSelection: () => void;
}

export function useSelectionNavigation({
  selectionPath,
  paramName,
  returnPath,
  currentValue,
  onSelection,
  stayOnSelect,
  extraParams,
}: UseSelectionNavigationOptions): UseSelectionNavigationResult {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const rawValue = getSingleParamValue(params[paramName]);

  useEffect(() => {
    if (rawValue === undefined) return;

    if (rawValue === CLEAR_SELECTION_VALUE) {
      onSelection(null);
    } else {
      onSelection(rawValue);
    }

    router.replace(returnPath);
  }, [rawValue, onSelection, router, returnPath]);

  const openSelector = useCallback(() => {
    const hasValue =
      currentValue !== undefined && currentValue !== null && `${currentValue}` !== '';

    const path = buildSelectionPath(selectionPath, {
      selectedId: hasValue ? currentValue : undefined,
      returnTo: returnPath,
      returnParam: paramName,
      stayOnSelect,
      extraParams,
    });

    router.push(path);
  }, [
    selectionPath,
    currentValue,
    returnPath,
    paramName,
    stayOnSelect,
    extraParams,
    router,
  ]);

  const clearSelection = useCallback(() => {
    onSelection(null);
  }, [onSelection]);

  return { openSelector, clearSelection };
}

