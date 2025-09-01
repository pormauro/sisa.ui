// /contexts/CategoriesContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  type: 'income' | 'expense';
}

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
  const [categories, setCategories] = useState<Category[]>([]);
  const { token } = useContext(AuthContext);

  const loadCategories = async () => {
    try {
      const response = await fetch(`${BASE_URL}/categories`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const addCategory = async (category: Omit<Category, 'id'>): Promise<Category | null> => {
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
        return newCategory;
      }
    } catch (error) {
      console.error('Error adding category:', error);
    }
    return null;
  };

  const updateCategory = async (id: number, category: Omit<Category, 'id'>): Promise<boolean> => {
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
      if (data.message === 'Category updated successfully') {
        setCategories(prev => prev.map(c => (c.id === id ? { id, ...category } : c)));
        return true;
      }
    } catch (error) {
      console.error('Error updating category:', error);
    }
    return false;
  };

  const deleteCategory = async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/categories/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.message === 'Category deleted successfully') {
        setCategories(prev => prev.filter(c => c.id !== id));
        return true;
      }
    } catch (error) {
      console.error('Error deleting category:', error);
    }
    return false;
  };

  useEffect(() => {
    if (token) {
      loadCategories();
    }
  }, [token]);

  return (
    <CategoriesContext.Provider value={{ categories, loadCategories, addCategory, updateCategory, deleteCategory }}>
      {children}
    </CategoriesContext.Provider>
  );
};

