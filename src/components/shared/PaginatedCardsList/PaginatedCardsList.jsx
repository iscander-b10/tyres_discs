import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CloseCircleFilled, LoadingOutlined } from '@ant-design/icons';
import { Alert, Dropdown, Empty, Flex, Input, Pagination } from 'antd';
import { ReactComponent as SortIcon } from '../../../icons/Sotring.svg';
import { ReactComponent as ItemsPerPageIcon } from '../../../icons/Items_Per_Page_Selector.svg';
import HoverTooltip from '../HoverTooltip';
import './PaginatedCardsList.scss';

const DEFAULT_ITEMS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 600;
const ITEMS_PER_PAGE_STORAGE_KEY = 'ivanor-catalog-items-per-page';
const PAGE_SIZE_OPTIONS = [20, 40, 60, 80, 100];

const SORT_MODES = {
  DEFAULT: 'default',
  PRICE_ASC: 'priceAsc',
  PRICE_DESC: 'priceDesc',
  ALPHABET_ASC: 'alphabetAsc',
  ALPHABET_DESC: 'alphabetDesc',
};

const SORT_MENU_ITEMS = [
  { key: SORT_MODES.DEFAULT, label: 'По умолчанию' },
  { key: SORT_MODES.PRICE_ASC, label: 'По цене (дешевле → дороже)' },
  { key: SORT_MODES.PRICE_DESC, label: 'По цене (дороже → дешевле)' },
  { key: SORT_MODES.ALPHABET_ASC, label: 'По алфавиту (А → Я)' },
  { key: SORT_MODES.ALPHABET_DESC, label: 'По алфавиту (Я → А)' },
];

const PAGE_SIZE_MENU_ITEMS = PAGE_SIZE_OPTIONS.map((size) => ({
  key: String(size),
  label: `${size} на странице`,
}));

const isValidPageSize = (value) => PAGE_SIZE_OPTIONS.includes(value);

const readStoredItemsPerPage = (fallback = DEFAULT_ITEMS_PER_PAGE) => {
  const safeFallback = isValidPageSize(fallback) ? fallback : DEFAULT_ITEMS_PER_PAGE;

  try {
    const stored = window.localStorage.getItem(ITEMS_PER_PAGE_STORAGE_KEY);
    const num = Number(stored);
    if (isValidPageSize(num)) return num;
  } catch {
    /* ignore */
  }

  return safeFallback;
};

const persistItemsPerPage = (value) => {
  try {
    window.localStorage.setItem(ITEMS_PER_PAGE_STORAGE_KEY, String(value));
  } catch {
    /* ignore */
  }
};

const getSortablePrice = (item) => {
  const raw = item?.sellingPrice ?? item?.price ?? item?.cost ?? null;
  const num = typeof raw === 'number' ? raw : raw != null ? Number(String(raw).replace(',', '.')) : NaN;
  return Number.isFinite(num) ? num : null;
};

const getSortableText = (item) => String(item?.title ?? item?.brand ?? '').toLocaleLowerCase('ru');

const matchesTitleSearch = (item, normalizedQuery) => {
  if (!normalizedQuery) return true;
  const title = String(item?.title ?? '').toLowerCase();
  return title.includes(normalizedQuery);
};

const PaginatedCardsList = ({
  items,
  error,
  isClientMode,
  renderCard,
  emptyText = 'Ничего не найдено. Попробуйте изменить параметры поиска.',
  itemsPerPage: itemsPerPageProp = DEFAULT_ITEMS_PER_PAGE,
  containerClassName,
  gridClassName,
  searchResetKey = 0,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortMode, setSortMode] = useState(SORT_MODES.DEFAULT);
  const [itemsPerPage, setItemsPerPage] = useState(() => readStoredItemsPerPage(itemsPerPageProp));
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceTimerRef = useRef(null);

  const clearDebounceTimer = () => {
    if (debounceTimerRef.current == null) return;
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = null;
  };

  const applySearchImmediately = (value) => {
    clearDebounceTimer();
    setSearchQuery(value);
    setDebouncedQuery(value);
  };

  useEffect(() => {
    clearDebounceTimer();
    setSearchQuery('');
    setDebouncedQuery('');
  }, [searchResetKey]);

  useEffect(() => () => clearDebounceTimer(), []);

  const normalizedSearchQuery = useMemo(
    () => debouncedQuery.trim().toLowerCase(),
    [debouncedQuery]
  );

  const isSearchPending = searchQuery.trim() !== '' && searchQuery !== debouncedQuery;

  useEffect(() => {
    setCurrentPage(1);
  }, [items, sortMode, debouncedQuery, itemsPerPage]);

  const safeItems = useMemo(() => items ?? null, [items]);

  const filteredItems = useMemo(() => {
    if (!safeItems) return null;
    if (!normalizedSearchQuery) return safeItems;
    return safeItems.filter((item) => matchesTitleSearch(item, normalizedSearchQuery));
  }, [safeItems, normalizedSearchQuery]);

  const sortedItems = useMemo(() => {
    if (!filteredItems) return null;
    if (sortMode === SORT_MODES.DEFAULT) return filteredItems;

    const copy = filteredItems.slice();

    if (sortMode === SORT_MODES.PRICE_ASC || sortMode === SORT_MODES.PRICE_DESC) {
      const dir = sortMode === SORT_MODES.PRICE_ASC ? 1 : -1;
      copy.sort((a, b) => {
        const pa = getSortablePrice(a);
        const pb = getSortablePrice(b);
        if (pa == null && pb == null) return 0;
        if (pa == null) return 1;
        if (pb == null) return -1;
        return dir * (pa - pb);
      });
      return copy;
    }

    if (sortMode === SORT_MODES.ALPHABET_ASC || sortMode === SORT_MODES.ALPHABET_DESC) {
      const dir = sortMode === SORT_MODES.ALPHABET_ASC ? 1 : -1;
      copy.sort((a, b) => dir * getSortableText(a).localeCompare(getSortableText(b), 'ru'));
      return copy;
    }

    return filteredItems;
  }, [filteredItems, sortMode]);

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchQuery(value);

    if (!value.trim()) {
      clearDebounceTimer();
      setDebouncedQuery('');
      return;
    }

    clearDebounceTimer();
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(value);
      debounceTimerRef.current = null;
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleSearchClear = () => {
    applySearchImmediately('');
  };

  const handleItemsPerPageChange = (key) => {
    const next = Number(key);
    if (!isValidPageSize(next) || next === itemsPerPage) return;
    setItemsPerPage(next);
    persistItemsPerPage(next);
  };

  if (error) {
    return (
      <Alert
        message="Ошибка поиска"
        description={error}
        type="error"
        showIcon
        className="error-alert"
      />
    );
  }

  if (!safeItems) return null;

  const totalItems = sortedItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageData = sortedItems.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasSourceItems = safeItems.length > 0;
  const hasVisibleItems = totalItems > 0;
  const showSearchClear = searchQuery.trim() !== '' && !isSearchPending;

  const searchSuffix = isSearchPending ? (
    <span className="list-toolbar__search-affix" aria-hidden="true">
      <LoadingOutlined className="list-toolbar__search-loading-icon" spin />
    </span>
  ) : showSearchClear ? (
    <button
      type="button"
      className="list-toolbar__search-clear"
      aria-label="Очистить поиск"
      onClick={handleSearchClear}
      onMouseDown={(event) => event.preventDefault()}
    >
      <CloseCircleFilled className="list-toolbar__search-clear-icon" aria-hidden />
    </button>
  ) : (
    <span className="list-toolbar__search-affix" aria-hidden="true" />
  );

  return (
    <Flex className={containerClassName} vertical>
      {hasSourceItems && (
        <Flex className="list-toolbar" align="flex-end" wrap="wrap">
          <Input
            className="list-toolbar__search"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Поиск: По названию"
            aria-label="Поиск по названию"
            aria-busy={isSearchPending || undefined}
            suffix={searchSuffix}
          />
          <span className="list-toolbar__search-status" role="status" aria-live="polite">
            {isSearchPending ? 'Фильтрация…' : ''}
          </span>
          <div className="list-toolbar__actions">
            <HoverTooltip title="Сортировка" placement="bottom">
              <span className="list-toolbar__icon-wrap">
                <Dropdown
                  menu={{
                    items: SORT_MENU_ITEMS,
                    selectedKeys: [sortMode],
                    onClick: ({ key }) => setSortMode(key),
                  }}
                  trigger={['click']}
                  overlayClassName="catalog-search-select-dropdown"
                >
                  <button
                    type="button"
                    className="list-toolbar__icon-btn"
                    aria-label="Сортировка"
                    aria-haspopup="menu"
                  >
                    <SortIcon className="list-toolbar__icon" aria-hidden />
                  </button>
                </Dropdown>
              </span>
            </HoverTooltip>
            <HoverTooltip title="Товаров на странице" placement="bottom">
              <span className="list-toolbar__icon-wrap">
                <Dropdown
                  menu={{
                    items: PAGE_SIZE_MENU_ITEMS,
                    selectedKeys: [String(itemsPerPage)],
                    onClick: ({ key }) => handleItemsPerPageChange(key),
                  }}
                  trigger={['click']}
                  overlayClassName="catalog-search-select-dropdown"
                >
                  <button
                    type="button"
                    className="list-toolbar__icon-btn"
                    aria-label="Количество товаров на странице"
                    aria-haspopup="menu"
                  >
                    <ItemsPerPageIcon className="list-toolbar__icon" aria-hidden />
                  </button>
                </Dropdown>
              </span>
            </HoverTooltip>
          </div>
        </Flex>
      )}
      {hasVisibleItems ? (
        <>
          <Flex className={gridClassName}>
            {currentPageData.map((item) => renderCard(item, { isClientMode }))}
          </Flex>
          {totalPages > 1 && (
            <Flex className="pagination-container" justify="center">
              <Pagination
                current={currentPage}
                total={totalItems}
                pageSize={itemsPerPage}
                onChange={handlePageChange}
                showSizeChanger={false}
                showTotal={(total, range) => `${range[0]}-${range[1]} из ${total}`}
              />
            </Flex>
          )}
        </>
      ) : (
        <Flex className="empty-state" justify="center" align="center">
          <Empty description={emptyText} />
        </Flex>
      )}
    </Flex>
  );
};

export default PaginatedCardsList;
