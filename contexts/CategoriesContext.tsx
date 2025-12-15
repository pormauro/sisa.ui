// /contexts/CategoriesContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { BootstrapResult } from '@/contexts/bootstrapTypes';
import { useCachedState } from '@/hooks/useCachedState';
import {
  ensureSortedByNewest,
  getDefaultSortValue,
  sortByNewest,
  toComparableNumber,
} from '@/utils/sort';

type CategoryType = 'income' | 'expense';

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  type: CategoryType;
  user_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

const parseNumeric = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const parseCategoryType = (value: unknown): CategoryType | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'income' || normalized === 'ingreso') {
    return 'income';
  }
  if (normalized === 'expense' || normalized === 'gasto') {
    return 'expense';
  }

  return null;
};

const normalizeDate = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

type RawCategory = Record<string, unknown>;

const normalizeCategory = (raw: unknown): Category | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as RawCategory;
  const id = parseNumeric(record.id);
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const type = parseCategoryType(record.type);

  if (id === null || !name || !type) {
    return null;
  }

  const parentParsed = parseNumeric(record.parent_id);
  const parentId = parentParsed === null || parentParsed === 0 ? null : parentParsed;
  const userParsed = parseNumeric(record.user_id);
  const userId = userParsed === null ? null : userParsed;
  const createdAt = normalizeDate(record.created_at);
  const updatedAt = normalizeDate(record.updated_at);

  return {
    id,
    parent_id: parentId,
    name,
    type,
    user_id: userId,
    created_at: createdAt,
    updated_at: updatedAt,
  };
};

const getCategoryKey = (category: Category): string =>
  `${category.type}:${category.name.trim().toLowerCase()}`;

const preferCategory = (current: Category, candidate: Category): Category => {
  const currentHasUser = current.user_id !== null && current.user_id !== undefined;
  const candidateHasUser = candidate.user_id !== null && candidate.user_id !== undefined;

  if (currentHasUser !== candidateHasUser) {
    return candidateHasUser ? candidate : current;
  }

  const currentSortValue = toComparableNumber(getDefaultSortValue(current));
  const candidateSortValue = toComparableNumber(getDefaultSortValue(candidate));

  if (candidateSortValue !== currentSortValue) {
    return candidateSortValue > currentSortValue ? candidate : current;
  }

  return candidate.id > current.id ? candidate : current;
};

const dedupeCategories = (items: Category[]): Category[] => {
  const map = new Map<string, Category>();

  for (const item of items) {
    const key = getCategoryKey(item);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      continue;
    }

    map.set(key, preferCategory(existing, item));
  }

  return Array.from(map.values());
};

const toCategoryArray = (payload: unknown): Category[] => {
  const sourceArray: unknown[] | null = (() => {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      const objectPayload = payload as Record<string, unknown>;
      if (Array.isArray(objectPayload.categories)) {
        return objectPayload.categories as unknown[];
      }
      if (Array.isArray(objectPayload.data)) {
        return objectPayload.data as unknown[];
      }
      const nestedData = objectPayload.data;
      if (nestedData && typeof nestedData === 'object') {
        const nestedRecord = nestedData as Record<string, unknown>;
        if (Array.isArray(nestedRecord.categories)) {
          return nestedRecord.categories as unknown[];
        }
      }
    }

    return null;
  })();

  if (!sourceArray) {
    return [];
  }

  const normalized = sourceArray
    .map(normalizeCategory)
    .filter((item): item is Category => item !== null);

  return dedupeCategories(normalized);
};

export type DefaultCategoryDefinition = Omit<Category, 'id'>;

export const DEFAULT_INCOME_CATEGORY_NAME = 'Ingresos totales';
export const DEFAULT_EXPENSE_CATEGORY_NAME = 'Gastos totales';

export const DEFAULT_CATEGORY_DEFINITIONS: ReadonlyArray<DefaultCategoryDefinition> = [
  { name: DEFAULT_INCOME_CATEGORY_NAME, type: 'income', parent_id: null },
  { name: DEFAULT_EXPENSE_CATEGORY_NAME, type: 'expense', parent_id: null },
] as const;

export const DEFAULT_CATEGORY_NAMES: Record<'income' | 'expense', string> = {
  income: DEFAULT_INCOME_CATEGORY_NAME,
  expense: DEFAULT_EXPENSE_CATEGORY_NAME,
};

interface CategoriesContextValue {
  categories: Category[];
  loadCategories: () => Promise<BootstrapResult>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category | null>;
  updateCategory: (id: number, category: Omit<Category, 'id'>) => Promise<boolean>;
  deleteCategory: (id: number) => Promise<boolean>;
}

export const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  loadCategories: async () => ({ source: 'unknown' }),
  addCategory: async () => null,
  updateCategory: async () => false,
  deleteCategory: async () => false,
});

export const CategoriesProvider = ({ children }: { children: ReactNode }) => {
  const [categories, setCategories, categoriesHydrated] = useCachedState<Category[]>(
    'categories',
    []
  );
  const { token } = useContext(AuthContext);
  const ensuringDefaultsRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const applyFetchedCategories = useCallback(
    (items: Category[]) => {
      const sanitized = toCategoryArray(items);
      setCategories(sortByNewest(sanitized, getDefaultSortValue));
    },
    [setCategories]
  );

  const fetchCategories = useCallback(async (): Promise<Category[]> => {
    if (!token) {
      console.warn('Skipping categories fetch because no auth token is available.');
      return [];
    }

    const response = await fetch(`${BASE_URL}/categories`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    try {
      const data = await response.json();
      const categoriesArray = toCategoryArray(data);
      if (categoriesArray.length > 0) {
        return categoriesArray;
      }
    } catch (error) {
      console.error('Error parsing categories response:', error);
    }

    if (!response.ok) {
      console.error('Error loading categories:', response.statusText);
    }

    return [];
  }, [token]);

  const ensureDefaultCategories = useCallback(
    async (existingCategories: Category[]) => {
      if (!token) {
        return;
      }

      const lowercasedExisting = existingCategories.map(category => ({
        ...category,
        normalizedName: category.name.trim().toLowerCase(),
      }));

      const missingDefaults = DEFAULT_CATEGORY_DEFINITIONS.filter(defaultCategory =>
        !lowercasedExisting.some(
          category =>
            category.type === defaultCategory.type &&
            category.normalizedName === defaultCategory.name.trim().toLowerCase()
        )
      );

      if (missingDefaults.length === 0 || ensuringDefaultsRef.current) {
        return;
      }

      ensuringDefaultsRef.current = true;

      try {
        for (const defaultCategory of missingDefaults) {
          try {
            const response = await fetch(`${BASE_URL}/categories`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(defaultCategory),
            });

            const data = await response.json();
            if (!response.ok || !data?.category_id) {
              console.error(
                'Error ensuring default category:',
                (data && (data.error as string)) || response.statusText
              );
            }
          } catch (error) {
            console.error('Error ensuring default category:', error);
          }
        }

        try {
          const refreshed = await fetchCategories();
          applyFetchedCategories(refreshed);
        } catch (error) {
          console.error('Error refreshing categories after ensuring defaults:', error);
        }
      } finally {
        ensuringDefaultsRef.current = false;
      }
    },
    [applyFetchedCategories, fetchCategories, token]
  );

  useEffect(() => {
    setCategories(prev => ensureSortedByNewest(toCategoryArray(prev), getDefaultSortValue));
  }, [setCategories]);

  const loadCategories = useCallback(async (): Promise<BootstrapResult> => {
    try {
      const fetched = await fetchCategories();
      hasFetchedRef.current = true;
      applyFetchedCategories(fetched);
      await ensureDefaultCategories(fetched);
      return { source: 'server' };
    } catch (error) {
      console.error('Error loading categories:', error);
      return {
        source: 'failed',
        error: error instanceof Error ? error.message : 'No fue posible cargar las categorías.',
      };
    }
  }, [applyFetchedCategories, ensureDefaultCategories, fetchCategories]);

  const addCategory = useCallback(
    async (category: Omit<Category, 'id'>): Promise<Category | null> => {
      if (!token) {
        console.warn('Cannot add category without an auth token.');
        return null;
      }

      try {
        const response = await fetch(`${BASE_URL}/categories`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(category),
        });
        const data = await response.json();
        if (data.category_id) {
          const newCategory = normalizeCategory({ id: data.category_id, ...category });
          if (newCategory) {
            setCategories(prev => ensureSortedByNewest([...prev, newCategory], getDefaultSortValue));
          }
          await loadCategories();
          return newCategory ?? null;
        }
      } catch (error) {
        console.error('Error adding category:', error);
      }
      return null;
    },
    [loadCategories, setCategories, token]
  );

  const updateCategory = useCallback(
    async (id: number, category: Omit<Category, 'id'>): Promise<boolean> => {
      if (!token) {
        console.warn('Cannot update category without an auth token.');
        return false;
      }

      try {
        const response = await fetch(`${BASE_URL}/categories/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(category),
        });
        const data = await response.json();
        if (!response.ok || data?.error) {
          console.error('Error updating category:', data?.error ?? response.statusText);
          return false;
        }
        const updatedCategory = normalizeCategory({ id, ...category });
        setCategories(prev =>
          ensureSortedByNewest(
            prev.map(c => (c.id === id && updatedCategory ? updatedCategory : c)),
            getDefaultSortValue
          )
        );
        await loadCategories();
        return true;
      } catch (error) {
        console.error('Error updating category:', error);
      }
      return false;
    },
    [loadCategories, setCategories, token]
  );

  const deleteCategory = useCallback(
    async (id: number): Promise<boolean> => {
      if (!token) {
        console.warn('Cannot delete category without an auth token.');
        return false;
      }

      try {
        const response = await fetch(`${BASE_URL}/categories/${id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const responseText = await response.text();
        let data: Record<string, unknown> | null = null;

        if (responseText) {
          try {
            const parsed = JSON.parse(responseText) as unknown;
            if (parsed && typeof parsed === 'object') {
              data = parsed as Record<string, unknown>;
            }
          } catch (parseError) {
            console.warn('Unexpected delete category response format:', parseError);
          }
        }

        if (!response.ok) {
          const errorMessage =
            (data && typeof data.error === 'string' && data.error) ||
            (data && typeof data.message === 'string' && data.message) ||
            response.statusText;
          console.error('Error deleting category:', errorMessage);
          return false;
        }

        if (data && typeof data.error === 'string') {
          console.error('Error deleting category:', data.error);
          return false;
        }

        setCategories(prev => prev.filter(c => c.id !== id));
        await loadCategories();
        return true;
      } catch (error) {
        console.error('Error deleting category:', error);
      }
      return false;
    },
    [loadCategories, setCategories, token]
  );

  useEffect(() => {
    if (!token) {
      hasFetchedRef.current = false;
    }
  }, [token]);

  useEffect(() => {
    if (!token || !categoriesHydrated || hasFetchedRef.current) {
      return;
    }

    hasFetchedRef.current = true;
    void loadCategories();
  }, [categoriesHydrated, loadCategories, token]);

  useEffect(() => {
    if (!token || !categoriesHydrated || !hasFetchedRef.current || ensuringDefaultsRef.current) {
      return;
    }

    void ensureDefaultCategories(categories);
  }, [categories, categoriesHydrated, ensureDefaultCategories, token]);

  return (
    <CategoriesContext.Provider value={{ categories, loadCategories, addCategory, updateCategory, deleteCategory }}>
      {children}
    </CategoriesContext.Provider>
  );
};

