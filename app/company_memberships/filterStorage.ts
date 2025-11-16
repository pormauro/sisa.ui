import AsyncStorage from '@react-native-async-storage/async-storage';

import type { MembershipFilterState } from '@/app/company_memberships/filterTypes';

const LAST_FILTERS_KEY = 'companyMemberships:lastFilters';
const SAVED_VIEWS_KEY = 'companyMemberships:savedViews';

export interface MembershipSavedView extends MembershipFilterState {
  id: string;
  name: string;
  createdAt: string;
  usageCounter: number;
}

const parseJson = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const loadLastFilters = async (): Promise<Partial<MembershipFilterState> | null> => {
  const stored = await AsyncStorage.getItem(LAST_FILTERS_KEY);
  return parseJson<Partial<MembershipFilterState>>(stored);
};

export const persistLastFilters = async (
  filters: MembershipFilterState
): Promise<void> => {
  await AsyncStorage.setItem(LAST_FILTERS_KEY, JSON.stringify(filters));
};

export const loadSavedViews = async (): Promise<MembershipSavedView[]> => {
  const stored = await AsyncStorage.getItem(SAVED_VIEWS_KEY);
  const parsed = parseJson<MembershipSavedView[]>(stored);
  if (!parsed || !Array.isArray(parsed)) {
    return [];
  }
  return parsed;
};

const persistSavedViews = async (views: MembershipSavedView[]): Promise<void> => {
  await AsyncStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
};

export const saveNewView = async (
  name: string,
  filters: MembershipFilterState
): Promise<MembershipSavedView[]> => {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('El nombre de la vista no puede estar vacío.');
  }
  const existing = await loadSavedViews();
  const view: MembershipSavedView = {
    ...filters,
    id: `view-${Date.now()}`,
    name: normalizedName,
    createdAt: new Date().toISOString(),
    usageCounter: 0,
  };
  const updated = [...existing, view];
  await persistSavedViews(updated);
  return updated;
};

export const deleteView = async (viewId: string): Promise<MembershipSavedView[]> => {
  const existing = await loadSavedViews();
  const updated = existing.filter(view => view.id !== viewId);
  await persistSavedViews(updated);
  return updated;
};

export const touchViewUsage = async (
  viewId: string
): Promise<MembershipSavedView[]> => {
  const existing = await loadSavedViews();
  const updated = existing.map(view =>
    view.id === viewId
      ? { ...view, usageCounter: view.usageCounter + 1 }
      : view
  );
  await persistSavedViews(updated);
  return updated;
};
