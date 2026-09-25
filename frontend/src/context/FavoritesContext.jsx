import { createContext, useContext, useEffect, useMemo, useState } from 'react';
      return saved ? stripSensitive(JSON.parse(saved)) : [];    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (product) => {
    setFavorites((current) => current.some((item) => item.id === product.id)
      ? current.filter((item) => item.id !== product.id)
      : [...current, stripSensitive(product)]);  };

  const isFavorite = (id) => favorites.some((item) => item.id === id);
  const favoriteIds = useMemo(() => favorites.map((item) => item.id), [favorites]);

  return <FavoritesContext.Provider value={{ favorites, favoriteIds, toggleFavorite, isFavorite }}>
    {children}
  </FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used inside FavoritesProvider');
  return context;
}
