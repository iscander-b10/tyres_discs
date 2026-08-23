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
  isCatalogItemSellable,
  parseStock,
  reconcileCartItems,
  snapshotCartItem,
} from './cartUtils';

const LEGACY_CART_KEY = 'ivanor.cart.v1';
const CART_STORAGE_VERSION = 2;

export function getCartStorageKey(mode = 'staff') {
  return mode === 'demo' ? 'cart.demo.v2' : 'cart.staff.v2';
}

const CartContext = createContext(null);

const readItemsFromRawStorage = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (
      parsed?.version === CART_STORAGE_VERSION &&
      Array.isArray(parsed.items)
    ) {
      return parsed.items;
    }
  } catch {
    return null;
  }
  return null;
};

export const readStoredItems = () => {
  try {
    const storageKeys = [
      getCartStorageKey('staff'),
      'cart.staff.v1',
      LEGACY_CART_KEY,
    ];
    for (const key of storageKeys) {
      const items = readItemsFromRawStorage(localStorage.getItem(key));
      if (items) {
        return items.filter(
          (row) => row && typeof row.key === 'string' && row.key
        );
      }
    }
    return [];
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => readStoredItems());

  useEffect(() => {
    try {
      localStorage.setItem(
        getCartStorageKey('staff'),
        JSON.stringify({ version: CART_STORAGE_VERSION, items })
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, [items]);

  const addItem = useCallback((item, category, qty) => {
    if (!isCatalogItemSellable(item, category)) return false;

    const key = getCartItemKey(item, category);
    const stock = parseStock(item?.amount);

    const initialQty =
      qty != null ? clampCartQty(qty, stock) : getDefaultCartQty(item.amount);
    if (initialQty <= 0) return false;

    setItems((prev) => {
      const existing = prev.find((row) => row.key === key);
      if (existing) {
        return prev.map((row) =>
          row.key === key
            ? {
                ...snapshotCartItem(
                  item,
                  category,
                  clampCartQty(row.quantity, stock)
                ),
                quantity: clampCartQty(row.quantity, stock),
                maxStock: stock,
              }
            : row
        );
      }
      return [...prev, snapshotCartItem(item, category, initialQty)];
    });
    return true;
  }, []);

  const lastReconciledVersionRef = React.useRef('');

  const reconcileCatalog = useCallback(({ version, results }) => {
    if (!version || version <= lastReconciledVersionRef.current) return false;
    lastReconciledVersionRef.current = version;
    setItems((currentItems) => reconcileCartItems(currentItems, results));
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
      reconcileCatalog,
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
      reconcileCatalog,
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
