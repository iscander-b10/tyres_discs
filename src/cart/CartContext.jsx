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

const LEGACY_CART_KEY = 'ivanor.cart.v1';

export function getCartStorageKey(mode = 'staff') {
  return mode === 'demo' ? 'cart.demo.v1' : 'cart.staff.v1';
}

function migrateLegacyCart() {
  const newKey = getCartStorageKey('staff');
  try {
    if (!localStorage.getItem(newKey)) {
      const legacy = localStorage.getItem(LEGACY_CART_KEY);
      if (legacy) localStorage.setItem(newKey, legacy);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

migrateLegacyCart();

const CartContext = createContext(null);

const readStoredItems = () => {
  try {
    const raw = localStorage.getItem(getCartStorageKey('staff'));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.key === 'string' && row.key);
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => readStoredItems());

  useEffect(() => {
    try {
      localStorage.setItem(getCartStorageKey('staff'), JSON.stringify(items));
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
      increment,
      decrement,
      removeItem,
      clear,
      getItem,
      totalQuantity,
      totals,
    }),
    [
      items,
      addItem,
      increment,
      decrement,
      removeItem,
      clear,
      getItem,
      totalQuantity,
      totals,
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
