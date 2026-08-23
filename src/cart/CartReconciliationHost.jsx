import { useCallback, useEffect, useRef } from 'react';
import { useAppShell } from '../app/AppShellContext';
import indexedDBService from '../services/indexedDBService';
import { useCart } from './CartContext';
import { isCartCategory } from './cartUtils';

const createCatalogReferences = (items) =>
  items
    .filter((line) => line?.id != null && String(line.id).trim() !== '')
    .map((line) => ({
      requestKey: isCartCategory(line.category)
        ? `${line.category}:${String(line.id)}`
        : line.key,
      category: isCartCategory(line.category) ? line.category : null,
      id: String(line.id),
    }));

const getReferencesSignature = (references) =>
  references.map((reference) => reference.requestKey).sort().join('|');

/** Non-visual bridge between catalog commit events, IndexedDB and the cart. */
export function CartReconciliationHost() {
  const { catalogSnapshotVersion } = useAppShell();
  const { items, reconcileCatalog } = useCart();
  const itemsRef = useRef(items);
  const mountedRef = useRef(false);
  const latestRequestRef = useRef(0);
  itemsRef.current = items;

  const reconcile = useCallback(
    async (requestedVersion = '') => {
      let references = createCatalogReferences(itemsRef.current);
      if (references.length === 0) return;

      while (mountedRef.current) {
        const requestNumber = latestRequestRef.current + 1;
        latestRequestRef.current = requestNumber;

        try {
          const catalogRead =
            await indexedDBService.readCartCatalogItems(references);
          if (
            !mountedRef.current ||
            requestNumber !== latestRequestRef.current ||
            !catalogRead.version ||
            (requestedVersion && catalogRead.version < requestedVersion)
          ) {
            return;
          }

          const latestReferences = createCatalogReferences(itemsRef.current);
          if (
            getReferencesSignature(latestReferences) !==
            getReferencesSignature(references)
          ) {
            references = latestReferences;
            if (references.length === 0) return;
            continue;
          }

          reconcileCatalog(catalogRead);
          return;
        } catch {
          // A failed or unconfirmed read must leave the cart untouched.
          return;
        }
      }
    },
    [reconcileCatalog]
  );

  useEffect(() => {
    mountedRef.current = true;
    reconcile();
    return () => {
      mountedRef.current = false;
      latestRequestRef.current += 1;
    };
  }, [reconcile]);

  useEffect(() => {
    if (catalogSnapshotVersion) {
      reconcile(catalogSnapshotVersion);
    }
  }, [catalogSnapshotVersion, reconcile]);

  return null;
}
