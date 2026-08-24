import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from '../auth/AuthContext';
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
import {
  createCartEnvelope,
  getCartStorageKey,
  isEnvelopeNewer,
  readCartEnvelope,
  writeCartEnvelope,
} from './cartStorage';
import { createCartSync } from './cartSync';
import { LegacyCartMigrationModal } from './LegacyCartMigrationModal';

export { getCartStorageKey } from './cartStorage';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { workspace, isWorkspaceReady } = useAuth();
  return (
    <CartProviderCore
      workspace={workspace}
      isWorkspaceReady={isWorkspaceReady}
    >
      {children}
    </CartProviderCore>
  );
}

export function CartProviderCore({
  children,
  workspace,
  isWorkspaceReady,
  storage = window.localStorage,
  syncFactory = createCartSync,
  showLegacyMigration = true,
}) {
  const [items, setItems] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const generationRef = useRef(0);
  const itemsRef = useRef([]);
  const envelopeRef = useRef(null);
  const activeRef = useRef(null);
  const syncRef = useRef(null);
  const lastReconciledVersionRef = useRef('');

  const replaceRuntime = useCallback((envelope, loaded = true) => {
    envelopeRef.current = envelope;
    itemsRef.current = envelope?.items ?? [];
    setItems(envelope?.items ?? []);
    setIsLoaded(loaded);
  }, []);

  useEffect(() => {
    const nextGeneration = generationRef.current + 1;
    generationRef.current = nextGeneration;
    syncRef.current?.close();
    syncRef.current = null;
    activeRef.current = null;
    lastReconciledVersionRef.current = '';
    replaceRuntime(null, false);

    const accountId = workspace?.accountId;
    const storeId = workspace?.storeId;
    if (!isWorkspaceReady || !accountId || !storeId) return undefined;

    activeRef.current = { accountId, storeId, generation: nextGeneration };
    let envelope;
    try {
      envelope =
        readCartEnvelope(storage, accountId, storeId) ??
        createCartEnvelope({ items: [], revision: 0, updatedAt: 0 });
    } catch {
      envelope = createCartEnvelope({ items: [], revision: 0, updatedAt: 0 });
    }
    replaceRuntime(envelope);

    const isCurrent = () => {
      const active = activeRef.current;
      return (
        active?.accountId === accountId &&
        active?.storeId === storeId &&
        active?.generation === nextGeneration
      );
    };

    try {
      syncRef.current = syncFactory({
        accountId,
        storeId,
        storage,
        onEnvelope: (incoming) => {
          if (!isCurrent() || !isEnvelopeNewer(incoming, envelopeRef.current)) {
            return;
          }
          replaceRuntime(incoming);
        },
      });
    } catch {
      syncRef.current = null;
    }

    return () => {
      if (!isCurrent()) return;
      syncRef.current?.close();
      syncRef.current = null;
      activeRef.current = null;
    };
  }, [
    isWorkspaceReady,
    replaceRuntime,
    storage,
    syncFactory,
    workspace?.accountId,
    workspace?.storeId,
  ]);

  const isCapturedCurrent = useCallback((captured) => {
    const active = activeRef.current;
    return (
      active?.accountId === captured?.accountId &&
      active?.storeId === captured?.storeId &&
      active?.generation === captured?.generation
    );
  }, []);

  const commitItems = useCallback(
    (update) => {
      const captured = activeRef.current;
      if (!captured || !isLoaded || !isCapturedCurrent(captured)) return false;

      const currentEnvelope =
        envelopeRef.current ??
        createCartEnvelope({ items: [], revision: 0, updatedAt: 0 });
      const nextItems = update(itemsRef.current);
      if (nextItems === itemsRef.current) return true;

      let nextEnvelope;
      try {
        nextEnvelope = createCartEnvelope({
          items: nextItems,
          revision: currentEnvelope.revision + 1,
          updatedAt: Math.max(Date.now(), currentEnvelope.updatedAt + 1),
        });
        writeCartEnvelope(
          storage,
          captured.accountId,
          captured.storeId,
          nextEnvelope
        );
      } catch {
        return false;
      }
      if (!isCapturedCurrent(captured)) return false;

      replaceRuntime(nextEnvelope);
      syncRef.current?.publish(nextEnvelope);
      return true;
    },
    [isCapturedCurrent, isLoaded, replaceRuntime, storage]
  );

  const addItem = useCallback((item, category, qty) => {
    if (!isCatalogItemSellable(item, category)) return false;

    const key = getCartItemKey(item, category);
    const stock = parseStock(item?.amount);

    const initialQty =
      qty != null ? clampCartQty(qty, stock) : getDefaultCartQty(item.amount);
    if (initialQty <= 0) return false;

    return commitItems((prev) => {
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
  }, [commitItems]);

  const reconcileCatalog = useCallback(({ version, results }) => {
    if (
      !isLoaded ||
      !version ||
      version <= lastReconciledVersionRef.current
    ) {
      return false;
    }
    lastReconciledVersionRef.current = version;
    return commitItems((currentItems) =>
      reconcileCartItems(currentItems, results)
    );
  }, [commitItems, isLoaded]);

  const increment = useCallback((key) => {
    return commitItems((prev) =>
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
  }, [commitItems]);

  const decrement = useCallback((key) => {
    return commitItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        return {
          ...row,
          quantity: Math.max(1, row.quantity - 1),
        };
      })
    );
  }, [commitItems]);

  const removeItem = useCallback((key) => {
    return commitItems((prev) => prev.filter((row) => row.key !== key));
  }, [commitItems]);

  const flush = useCallback(() => {
    const captured = activeRef.current;
    const envelope = envelopeRef.current;
    if (!captured || !envelope || !isCapturedCurrent(captured)) return false;
    try {
      writeCartEnvelope(
        storage,
        captured.accountId,
        captured.storeId,
        envelope
      );
      return isCapturedCurrent(captured);
    } catch {
      return false;
    }
  }, [isCapturedCurrent, storage]);

  const detach = useCallback(() => {
    const captured = activeRef.current;
    const snapshot = envelopeRef.current;
    if (captured) flush();
    syncRef.current?.close();
    syncRef.current = null;
    activeRef.current = null;
    generationRef.current += 1;
    replaceRuntime(null, false);
    return snapshot;
  }, [flush, replaceRuntime]);

  const clear = useCallback(() => {
    const captured = activeRef.current;
    const currentEnvelope = envelopeRef.current;
    if (!captured || !currentEnvelope || !isCapturedCurrent(captured)) {
      return false;
    }
    const clearedEnvelope = createCartEnvelope({
      items: [],
      revision: currentEnvelope.revision + 1,
      updatedAt: Math.max(Date.now(), currentEnvelope.updatedAt + 1),
    });
    try {
      storage.removeItem(
        getCartStorageKey(captured.accountId, captured.storeId)
      );
    } catch {
      return false;
    }
    if (!isCapturedCurrent(captured)) return false;
    replaceRuntime(clearedEnvelope);
    syncRef.current?.publish(clearedEnvelope);
    return true;
  }, [isCapturedCurrent, replaceRuntime, storage]);

  const handleMigrated = useCallback(
    (envelope) => {
      const captured = activeRef.current;
      if (!captured || !isCapturedCurrent(captured)) return false;
      replaceRuntime(envelope);
      syncRef.current?.publish(envelope);
      return true;
    },
    [isCapturedCurrent, replaceRuntime]
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
      isLoaded,
      addItem,
      increment,
      decrement,
      removeItem,
      clear,
      flush,
      detach,
      reconcileCatalog,
      getItem,
      totalQuantity,
      totals,
    }),
    [
      items,
      isLoaded,
      addItem,
      increment,
      decrement,
      removeItem,
      clear,
      flush,
      detach,
      reconcileCatalog,
      getItem,
      totalQuantity,
      totals,
    ]
  );

  const active = activeRef.current;
  return (
    <CartContext.Provider value={value}>
      {children}
      {showLegacyMigration && isLoaded && active ? (
        <LegacyCartMigrationModal
          accountId={active.accountId}
          storeId={active.storeId}
          generation={active.generation}
          storage={storage}
          isCurrent={() => isCapturedCurrent(active)}
          onMigrated={handleMigrated}
        />
      ) : null}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
