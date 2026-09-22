import { createContext, useContext, useEffect, useMemo, useState } from 'react';
<<<<<<< HEAD
=======
import { stripSensitive } from '../utils/catalogStorage';
>>>>>>> cbd8857 (push fitur notifikasi email)

const CartContext = createContext(null);
const CART_STORAGE_KEY = 'glosir_cart_v1';
const PROMO_STORAGE_KEY = 'glosir_promo_v1';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
<<<<<<< HEAD
      return saved ? JSON.parse(saved) : [];
=======
      // Keranjang lama bisa saja masih menyimpan harga modal dari versi sebelumnya; bersihkan saat dimuat.
      return saved ? stripSensitive(JSON.parse(saved)) : [];
>>>>>>> cbd8857 (push fitur notifikasi email)
    } catch {
      return [];
    }
  });
  const [promo, setPromo] = useState(() => localStorage.getItem(PROMO_STORAGE_KEY) || '');

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    if (promo) localStorage.setItem(PROMO_STORAGE_KEY, promo);
    else localStorage.removeItem(PROMO_STORAGE_KEY);
  }, [promo]);

  const addItem = (product) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }

<<<<<<< HEAD
      return [...prev, { ...product, qty: 1 }];
=======
      return [...prev, { ...stripSensitive(product), qty: 1 }];
>>>>>>> cbd8857 (push fitur notifikasi email)
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      return;
    }

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty } : item))
    );
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setItems([]);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.qty, 0),
    [items]
  );

  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.qty, 0),
    [items]
  );

  const discount = useMemo(() => {
    if (promo === 'LEBARAN15') return Math.round(totalPrice * 0.15);
    if (promo === 'GLOSIR10') return Math.round(totalPrice * 0.1);
    if (promo === 'HEMAT25') return Math.min(25000, totalPrice);
    if (promo === 'PARSEL20') return Math.round(totalPrice * 0.2);
    return 0;
  }, [promo, totalPrice]);

  const applyPromo = (code) => {
    const normalized = (code || '').trim().toUpperCase();
    if (!['LEBARAN15', 'GLOSIR10', 'HEMAT25', 'PARSEL20'].includes(normalized)) return false;
    setPromo(normalized);
    return true;
  };

  const removePromo = () => setPromo('');

  const value = {
    items,
    addItem,
    updateQty,
    removeItem,
    clearCart,
    totalItems,
    totalPrice,
    promo,
    discount,
    applyPromo,
    removePromo,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used inside CartProvider');
  }

  return context;
}
