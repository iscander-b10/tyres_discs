import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';
import indexedDBService, { CATALOG_STORES } from '../indexedDBService';
import { pickEqualityFilterKey, TIRE_SEARCH_INDEX_HINTS } from './catalogIdbQueries';
import { matchesTireSearchFilters } from './catalogSearchFilters';

/**
 * Моки: нет (изоляция FDBFactory).
 * Реально: hydrate getAll один раз + RAM search/facets на тысячах записей.
 * Риск: P0 — повторный getAll store на каждый Select / season перебивает width.
 */

const supplierA = 'Поставщик A';
const versionV1 = '2026-08-25T09:00:00Z';
const versionV2 = '2026-08-25T10:00:00Z';

const TIRE_COUNT = 4000;
const DISC_COUNT = 1500;

const makeTire = (i) => ({
  id: `t-${i}`,
  supplier: i % 3 === 0 ? supplierA : 'Поставщик B',
  brand: i % 7 === 0 ? 'Ikon' : 'Nokian',
  width: 165 + (i % 12) * 10,
  profile: 40 + (i % 6) * 5,
  diameter: `R${14 + (i % 6)}`,
  season: i % 3 === 0 ? 'w' : 's',
  spikes: i % 4 === 0 && i % 8 === 0,
  runflat: i % 19 === 0,
  amount: 1 + (i % 10),
  title: `Tire ${i}`,
  price: 4000 + (i % 50) * 10,
});

const makeDisc = (i) => ({
  id: `d-${i}`,
  supplier: i % 2 === 0 ? supplierA : 'Поставщик B',
  brand: i % 5 === 0 ? 'Replay' : 'OZ',
  diameter: `R${15 + (i % 5)}`,
  width: 6 + (i % 5) * 0.5,
  pcd: i % 2 === 0 ? 114.3 : 100,
  pn: i % 3 === 0 ? 5 : 4,
  cb: 66.1 + (i % 4),
  et: 35 + (i % 10),
  diskType: i % 3 === 0 ? 'Штампованный' : 'Литой',
  amount: 1 + (i % 8),
  title: `Disc ${i}`,
  price: 5000,
});

const resetService = (storeId) => {
  indexedDBService.catalogDb?.close?.();
  indexedDBService.catalogDb = null;
  indexedDBService.db = null;
  indexedDBService.discDb = null;
  indexedDBService._migrationComplete = false;
  indexedDBService._ensurePromise = null;
  indexedDBService._readStoreGetAllCount = 0;
  indexedDBService.setActiveStore(storeId);
};

const seedCatalog = async (tireCount, discCount) => {
  const tires = Array.from({ length: tireCount }, (_, i) => makeTire(i));
  tires.push({
    id: 't-cascade-205',
    supplier: supplierA,
    brand: 'Ikon',
    width: 205,
    profile: 55,
    diameter: 'R16',
    season: 's',
    spikes: false,
    runflat: false,
    amount: 8,
    title: 'Cascade 205',
    price: 8000,
  });
  tires.push({
    id: 't-cascade-215',
    supplier: supplierA,
    brand: 'Ikon',
    width: 215,
    profile: 55,
    diameter: 'R16',
    season: 's',
    spikes: false,
    runflat: false,
    amount: 8,
    title: 'Cascade 215',
    price: 8100,
  });

  await indexedDBService.applyCatalogSnapshot(
    [
      {
        supplier: supplierA,
        category: CATALOG_STORES.tires,
        action: 'replace',
        items: tires.filter((item) => item.supplier === supplierA),
      },
      {
        supplier: 'Поставщик B',
        category: CATALOG_STORES.tires,
        action: 'replace',
        items: tires.filter((item) => item.supplier === 'Поставщик B'),
      },
      {
        supplier: supplierA,
        category: CATALOG_STORES.discs,
        action: 'replace',
        items: Array.from({ length: discCount }, (_, i) => makeDisc(i)).filter(
          (item) => item.supplier === supplierA
        ),
      },
      {
        supplier: 'Поставщик B',
        category: CATALOG_STORES.discs,
        action: 'replace',
        items: Array.from({ length: discCount }, (_, i) => makeDisc(i)).filter(
          (item) => item.supplier === 'Поставщик B'
        ),
      },
    ],
    versionV1
  );
};

const searchWithCursor = (database, storeName, filters, matcher) =>
  new Promise((resolve, reject) => {
    const store = database.transaction(storeName, 'readonly').objectStore(storeName);
    const request = store.openCursor();
    const results = [];
    let visited = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve({ results, visited });
        return;
      }
      visited += 1;
      if (matcher(cursor.value, filters)) {
        results.push(cursor.value);
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });

describe('RAM read cache поиска и facets (fake-indexeddb)', () => {
  let originalIndexedDB;
  let originalKeyRange;

  beforeEach(() => {
    originalIndexedDB = global.indexedDB;
    originalKeyRange = global.IDBKeyRange;
    global.indexedDB = new FDBFactory();
    global.IDBKeyRange = FDBKeyRange;
    window.localStorage.clear();
    resetService(`read-cache-${Math.random()}`);
  });

  afterEach(() => {
    indexedDBService.catalogDb?.close?.();
    global.indexedDB = originalIndexedDB;
    global.IDBKeyRange = originalKeyRange;
  });

  test('каскад и search не делают повторный getAll; width не проигрывает season', async () => {
    await seedCatalog(TIRE_COUNT, DISC_COUNT);
    expect(indexedDBService._readStoreGetAllCount).toBe(0);

    const facetStarted = Date.now();
    const firstFacets = await indexedDBService.getAvailableParameterOptions({
      season: 's',
    });
    const hydrateMs = Date.now() - facetStarted;
    expect(indexedDBService._readStoreGetAllCount).toBe(1);
    expect(firstFacets.widths.length).toBeGreaterThan(0);

    const cascadeStarted = Date.now();
    const cascaded = await indexedDBService.getAvailableParameterOptions({
      season: 's',
      width: 205,
      profile: 55,
      diameter: 'R16',
    });
    const cascadeMs = Date.now() - cascadeStarted;
    expect(indexedDBService._readStoreGetAllCount).toBe(1);
    expect(cascaded.widths).toEqual(expect.arrayContaining([205, 215]));

    expect(
      pickEqualityFilterKey({ season: 's', width: 205 }, TIRE_SEARCH_INDEX_HINTS)
    ).toEqual({ key: 'width', value: 205 });

    const searchStarted = Date.now();
    const widthOnly = await indexedDBService.searchTires({
      season: 's',
      width: 205,
    });
    const sizeSearch = await indexedDBService.searchTires({
      season: 's',
      width: 205,
      profile: 55,
      diameter: 'R16',
    });
    const searchMs = Date.now() - searchStarted;
    expect(indexedDBService._readStoreGetAllCount).toBe(1);
    expect(widthOnly.length).toBeGreaterThan(0);
    expect(widthOnly.every((item) => Number(item.width) === 205)).toBe(true);
    expect(widthOnly.every((item) => item.season === 's')).toBe(true);
    expect(sizeSearch.some((item) => item.id === 't-cascade-205')).toBe(true);
    expect(sizeSearch.every((item) => item.id !== 't-cascade-215')).toBe(true);

    const spikes = await indexedDBService.searchTires({
      season: 'w',
      spikes: false,
    });
    expect(spikes.every((item) => item.spikes === false)).toBe(true);

    const multiBrand = await indexedDBService.searchTires({
      season: 's',
      brand: ['Ikon', 'Nokian'],
      minAmount: 4,
    });
    expect(multiBrand.every((item) => item.amount >= 4)).toBe(true);

    const runflat = await indexedDBService.searchTires({
      season: 's',
      runflat: true,
    });
    expect(runflat.every((item) => item.runflat === true)).toBe(true);

    const discFacets = await indexedDBService.getAvailableDiscParameterOptions({
      diameter: 'R16',
      pcd: 114.3,
    });
    const discs = await indexedDBService.searchDiscs({
      diameter: 'R16',
      pcd: 114.3,
      pn: 5,
      diskType: 'Литой',
      etFrom: 35,
      etTo: 45,
    });
    expect(indexedDBService._readStoreGetAllCount).toBe(2);
    expect(discFacets.diameters.length).toBeGreaterThan(0);
    expect(
      discs.every(
        (item) =>
          String(item.diameter) === 'R16' &&
          Number(item.pcd) === 114.3 &&
          Number(item.pn) === 5 &&
          item.diskType === 'Литой'
      )
    ).toBe(true);

    const { database } = await indexedDBService._getReadyContext();
    const cursorStarted = Date.now();
    const baseline = await searchWithCursor(
      database,
      CATALOG_STORES.tires,
      { season: 's', width: 205 },
      matchesTireSearchFilters
    );
    const cursorMs = Date.now() - cursorStarted;

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        hydrateMs,
        cascadeMs,
        searchMs,
        cursorMs,
        cursorVisited: baseline.visited,
        ramWidthOnly: widthOnly.length,
        tireGetAll: 1,
      })
    );

    expect(baseline.visited).toBeGreaterThan(widthOnly.length);
    expect(cascadeMs).toBeLessThan(cursorMs);
    expect(indexedDBService._readStoreGetAllCount).toBe(2);
  }, 60000);

  test('смена workspace не смешивает магазины; snapshot invalidate даёт свежие данные', async () => {
    const storeA = `cache-a-${Math.random()}`;
    resetService(storeA);
    await indexedDBService.applyCatalogSnapshot(
      [
        {
          supplier: supplierA,
          category: CATALOG_STORES.tires,
          action: 'replace',
          items: [makeTire(1), { ...makeTire(2), id: 'only-a', title: 'Only A' }],
        },
      ],
      versionV1
    );
    const fromA = await indexedDBService.searchTires({ season: 's' });
    expect(fromA.some((item) => item.id === 'only-a')).toBe(true);

    const storeB = `cache-b-${Math.random()}`;
    resetService(storeB);
    await indexedDBService.applyCatalogSnapshot(
      [
        {
          supplier: supplierA,
          category: CATALOG_STORES.tires,
          action: 'replace',
          items: [{ ...makeTire(3), id: 'only-b', title: 'Only B', season: 's' }],
        },
      ],
      versionV1
    );
    const fromB = await indexedDBService.searchTires({ season: 's' });
    expect(fromB.some((item) => item.id === 'only-a')).toBe(false);
    expect(fromB.some((item) => item.id === 'only-b')).toBe(true);

    await indexedDBService.applyCatalogSnapshot(
      [
        {
          supplier: supplierA,
          category: CATALOG_STORES.tires,
          action: 'replace',
          items: [{ ...makeTire(4), id: 'only-b2', title: 'Only B2', season: 's' }],
        },
      ],
      versionV2
    );
    const afterBump = await indexedDBService.searchTires({ season: 's' });
    expect(afterBump.some((item) => item.id === 'only-b')).toBe(false);
    expect(afterBump.some((item) => item.id === 'only-b2')).toBe(true);
  });
});
