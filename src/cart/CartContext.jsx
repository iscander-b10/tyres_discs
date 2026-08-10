import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  clampCartQty,
  getCartItemKey,
  getDefaultCartQty,
  getUnitB2bPrice,
  getUnitSellingPrice,
  parseStock,
  snapshotCartItem,
} from './cartUtils';

const STORAGE_KEY = 'ivanor.cart.v1';

const CartContext = createContext(null);

const readStoredItems = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.key === 'string' && row.key);
  } catch {
    return [];
  }
};

export function CartProvider({ children, onGoToBasket }) {
  const [items, setItems] = useState(() => readStoredItems());

  const goToBasket = useCallback(() => {
    onGoToBasket?.();
  }, [onGoToBasket]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota / private mode */
    }
  }, [items]);

  const addItem = useCallback((item, qty) => {
    const key = getCartItemKey(item);
    if (!key) return false;

    const stock = parseStock(item?.amount);
    if (stock <= 0) return false;

    const initialQty =
      qty != null ? clampCartQty(qty, stock) : getDefaultCartQty(item.amount);
    if (initialQty <= 0) return false;

    setItems((prev) => {
      const existing = prev.find((row) => row.key === key);
      if (existing) {
        return prev.map((row) =>
          row.key === key
            ? {
                ...snapshotCartItem(item, clampCartQty(row.quantity, stock)),
                quantity: clampCartQty(row.quantity, stock),
                maxStock: stock,
              }
            : row
        );
      }
      return [...prev, snapshotCartItem(item, initialQty)];
    });
    return true;
  }, []);

  const setQuantity = useCallback((key, qty) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        return {
          ...row,
          quantity: clampCartQty(qty, row.maxStock || row.amount),
        };
      })
    );
  }, []);

  const increment = useCallback((key) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const max = parseStock(row.maxStock ?? row.amount);
        const next = row.quantity + 1;
        return {
          ...row,
          quantity: max > 0 ? Math.min(next, max) : next,
        };
      })
    );
  }, []);

  const decrement = useCallback((key) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        return {
          ...row,
          quantity: Math.max(1, row.quantity - 1),
        };
      })
    );
  }, []);

  const removeItem = useCallback((key) => {
    setItems((prev) => prev.filter((row) => row.key !== key));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback(
    (item) => {
      const key = getCartItemKey(item);
      if (!key) return false;
      return items.some((row) => row.key === key);
    },
    [items]
  );

  const getItem = useCallback(
    (itemOrKey) => {
      const key =
        typeof itemOrKey === 'string' ? itemOrKey : getCartItemKey(itemOrKey);
      if (!key) return null;
      return items.find((row) => row.key === key) ?? null;
    },
    [items]
  );

  const totalQuantity = useMemo(
    () => items.reduce((sum, row) => sum + (row.quantity || 0), 0),
    [items]
  );

  const totals = useMemo(() => {
    let selling = 0;
    let b2b = 0;
    items.forEach((row) => {
      const q = row.quantity || 0;
      selling += getUnitSellingPrice(row) * q;
      b2b += getUnitB2bPrice(row) * q;
    });
    return { selling, b2b, positions: items.length, quantity: totalQuantity };
  }, [items, totalQuantity]);

  const value = useMemo(
    () => ({
      items,
      addItem,
      setQuantity,
      increment,
      decrement,
      removeItem,
      clear,
      isInCart,
      getItem,
      getCount: () => totalQuantity,
      totalQuantity,
      totals,
      goToBasket,
    }),
    [
      items,
      addItem,
      setQuantity,
      increment,
      decrement,
      removeItem,
      clear,
      isInCart,
      getItem,
      totalQuantity,
      totals,
      goToBasket,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
