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
import { useCachedState } from '@/hooks/useCachedState';
import { ensureSortedByNewest, getDefaultSortValue, sortByNewest } from '@/utils/sort';

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  type: 'income' | 'expense';
}

export type DefaultCategoryDefinition = Omit<Category, 'id'>;

export const DEFAULT_INCOME_CATEGORY_NAME = 'Ingresos principales';
export const DEFAULT_EXPENSE_CATEGORY_NAME = 'Gastos principales';

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
  loadCategories: () => void;
  addCategory: (category: Omit<Category, 'id'>) => Promise<Category | null>;
  updateCategory: (id: number, category: Omit<Category, 'id'>) => Promise<boolean>;
  deleteCategory: (id: number) => Promise<boolean>;
}

export const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  loadCategories: () => {},
  addCategory: async () => null,
  updateCategory: async () => false,
  deleteCategory: async () => false,
});

export const CategoriesProvider = ({ children }: { children: ReactNode }) => {
  const [categories, setCategories] = useCachedState<Category[]>(
    'categories',
    []
  );
  const { token } = useContext(AuthContext);
  const ensuringDefaultsRef = useRef(false);

  const applyFetchedCategories = useCallback(
    (items: Category[]) => {
      setCategories(sortByNewest(items, getDefaultSortValue));
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
      if (Array.isArray(data.categories)) {
        return data.categories as Category[];
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
    setCategories(prev => ensureSortedByNewest(prev, getDefaultSortValue));
  }, [setCategories]);

  const loadCategories = useCallback(async () => {
    try {
      const fetched = await fetchCategories();
      applyFetchedCategories(fetched);
      await ensureDefaultCategories(fetched);
    } catch (error) {
      console.error('Error loading categories:', error);
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
          const newCategory: Category = { id: parseInt(data.category_id, 10), ...category };
          setCategories(prev => [...prev, newCategory]);
          await loadCategories();
          return newCategory;
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
        setCategories(prev =>
          ensureSortedByNewest(
            prev.map(c => (c.id === id ? { id, ...category } : c)),
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
    if (token) {
      void loadCategories();
    }
  }, [loadCategories, token]);

  return (
    <CategoriesContext.Provider value={{ categories, loadCategories, addCategory, updateCategory, deleteCategory }}>
      {children}
    </CategoriesContext.Provider>
  );
};

