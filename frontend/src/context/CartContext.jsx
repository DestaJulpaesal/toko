import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { stripSensitive } from '../utils/catalogStorage';
import { apiFetch } from '../services/api';

const CartContext = createContext(null);
const CART_STORAGE_KEY = 'glosir_cart_v1';
const PROMO_STORAGE_KEY = 'glosir_promo_v1';

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      // Keranjang lama bisa saja masih menyimpan harga modal dari versi sebelumnya; bersihkan saat dimuat.
      return saved ? stripSensitive(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });
  const [promo, setPromo] = useState(() => localStorage.getItem(PROMO_STORAGE_KEY) || '');
  const [discount, setDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');

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

      return [...prev, { ...stripSensitive(product), qty: 1 }];
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

  useEffect(() => {
    if (!promo) {
      setDiscount(0);
      setPromoError('');
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiFetch('/promos/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          silentNotify: true,
          body: JSON.stringify({ code: promo, subtotal: totalPrice }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Promo tidak dapat digunakan.');
        if (!cancelled) {
          setDiscount(Number(result.discountAmount || 0));
          setPromoError('');
        }
      } catch (error) {
        if (!cancelled) {
          setDiscount(0);
          setPromoError(error.message || 'Promo belum dapat divalidasi.');
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [promo, totalPrice]);

  const applyPromo = async (code) => {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) return false;
    try {
      const response = await apiFetch('/promos/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        silentNotify: true,
        body: JSON.stringify({ code: normalized, subtotal: totalPrice }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setPromoError(result.message || 'Kode promo tidak dapat digunakan.');
        return false;
      }
      setPromo(normalized);
      setDiscount(Number(result.discountAmount || 0));
      setPromoError('');
      return true;
    } catch (error) {
      setPromoError(error.message || 'Promo belum dapat divalidasi.');
      return false;
    }
  };

  const removePromo = () => {
    setPromo('');
    setDiscount(0);
    setPromoError('');
  };

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
    promoError,
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
