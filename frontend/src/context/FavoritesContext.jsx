import { createContext, useContext, useEffect, useMemo, useState } from 'react';
<<<<<<< HEAD
=======
import { stripSensitive } from '../utils/catalogStorage';
>>>>>>> cbd8857 (push fitur notifikasi email)

const FavoritesContext = createContext(null);
const FAVORITES_STORAGE_KEY = 'glosir_favorites_v1';

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
<<<<<<< HEAD
      return saved ? JSON.parse(saved) : [];
=======
      return saved ? stripSensitive(JSON.parse(saved)) : [];
>>>>>>> cbd8857 (push fitur notifikasi email)
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (product) => {
    setFavorites((current) => current.some((item) => item.id === product.id)
      ? current.filter((item) => item.id !== product.id)
<<<<<<< HEAD
      : [...current, product]);
=======
      : [...current, stripSensitive(product)]);
>>>>>>> cbd8857 (push fitur notifikasi email)
  };

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
