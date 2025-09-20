// C:/Users/Mauri/Documents/GitHub/router/contexts/ProductsServicesContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import { BASE_URL } from '@/config/Index';
import { AuthContext } from '@/contexts/AuthContext';
import { useCachedState } from '@/hooks/useCachedState';

export interface ProductService {
  id: number;
  description: string;
  category: string;
  price: number;
  cost: number;
  difficulty: string;
  item_type: 'product' | 'service';
  stock: number | null;
  product_image_file_id: string | null;
  user_id: number;
}

interface ProductsServicesContextType {
  productsServices: ProductService[];
  loadProductsServices: () => void;
  addProductService: (item: Omit<ProductService, 'id' | 'user_id'>) => Promise<ProductService | null>;
  updateProductService: (id: number, item: Omit<ProductService, 'id' | 'user_id'>) => Promise<boolean>;
  deleteProductService: (id: number) => Promise<boolean>;
}

export const ProductsServicesContext = createContext<ProductsServicesContextType>({
  productsServices: [],
  loadProductsServices: () => {},
  addProductService: async () => null,
  updateProductService: async () => false,
  deleteProductService: async () => false,
});

export const ProductsServicesProvider = ({ children }: { children: ReactNode }) => {
  const [productsServices, setProductsServices] = useCachedState<ProductService[]>(
    'products_services',
    []
  );
  const { token } = useContext(AuthContext);

  const loadProductsServices = useCallback(async () => {
    try {
      const response = await fetch(`${BASE_URL}/products_services`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.products_services) setProductsServices(data.products_services);
    } catch (error) {
      console.error('Error loading products/services:', error);
    }
  }, [setProductsServices, token]);

  const addProductService = useCallback(
    async (item: Omit<ProductService, 'id' | 'user_id'>): Promise<ProductService | null> => {
      try {
        const response = await fetch(`${BASE_URL}/products_services`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(item),
        });
        const data = await response.json();
        if (data.id) {
          const newItem: ProductService = { id: data.id, user_id: 0, ...item };
          setProductsServices(prev => [...prev, newItem]);
          await loadProductsServices();
          return newItem;
        }
      } catch (error) {
        console.error('Error adding product/service:', error);
      }
      return null;
    },
    [loadProductsServices, setProductsServices, token]
  );

  const updateProductService = useCallback(
    async (id: number, item: Omit<ProductService, 'id' | 'user_id'>): Promise<boolean> => {
      try {
        const response = await fetch(`${BASE_URL}/products_services/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(item),
        });
        const data = await response.json();
        if (data.message === 'Record updated successfully') {
          setProductsServices(prev => prev.map(p => (p.id === id ? { ...p, ...item } : p)));
          await loadProductsServices();
          return true;
        }
      } catch (error) {
        console.error('Error updating product/service:', error);
      }
      return false;
    },
    [loadProductsServices, setProductsServices, token]
  );

  const deleteProductService = async (id: number): Promise<boolean> => {
    try {
      const response = await fetch(`${BASE_URL}/products_services/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.message === 'Record deleted successfully') {
        setProductsServices(prev => prev.filter(p => p.id !== id));
        return true;
      }
    } catch (error) {
      console.error('Error deleting product/service:', error);
    }
    return false;
  };

  useEffect(() => {
    if (token) void loadProductsServices();
  }, [loadProductsServices, token]);

  return (
    <ProductsServicesContext.Provider value={{ productsServices, loadProductsServices, addProductService, updateProductService, deleteProductService }}>
      {children}
    </ProductsServicesContext.Provider>
  );
};
