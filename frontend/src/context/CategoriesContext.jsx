import { createContext, useContext, useMemo } from 'react';
import { categoryService } from '../services/category.service';
import { useFetch } from '../hooks/useFetch';

const CategoriesContext = createContext(null);

/** Categories are needed on almost every screen, so they are loaded once and shared. */
export function CategoriesProvider({ children }) {
  const { data, loading, reload } = useFetch(categoryService.list, []);

  const value = useMemo(() => {
    const categories = data || [];
    return {
      categories,
      loading,
      reload,
      byType: (type) => categories.filter((c) => c.type === type),
      byId: (id) => categories.find((c) => c.id === id),
    };
  }, [data, loading, reload]);

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export const useCategories = () => useContext(CategoriesContext);
