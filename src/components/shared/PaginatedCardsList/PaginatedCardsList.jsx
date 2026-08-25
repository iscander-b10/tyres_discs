import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Alert, Button, Dropdown, Empty, Flex, Input, Pagination } from 'antd';
import { ReactComponent as SearchIcon } from '../../../icons/Search.svg';
import { ReactComponent as ClearIcon } from '../../../icons/Clear.svg';
import { ReactComponent as LoadingIcon } from '../../../icons/Loading.svg';
import { ReactComponent as SortIcon } from '../../../icons/Sotring.svg';
import { ReactComponent as PageSizeIcon } from '../../../icons/PageSize.svg';
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

/** Russian plural forms for «позиция» and agreeing «найдена/найдено». */
const positionsStatusParts = (count) => {
  const n = Math.abs(Number(count)) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) {
    return { verb: 'Найдено', word: 'позиций' };
  }
  if (last === 1) {
    return { verb: 'Найдена', word: 'позиция' };
  }
  if (last >= 2 && last <= 4) {
    return { verb: 'Найдено', word: 'позиции' };
  }
  return { verb: 'Найдено', word: 'позиций' };
};

const StatusCount = ({ value }) => (
  <span className="list-toolbar__status-count">{value}</span>
);

const buildListStatus = (matchedCount, sourceCount, hasQuery) => {
  const { verb, word } = positionsStatusParts(matchedCount);

  if (hasQuery) {
    const sourceWord = positionsStatusParts(sourceCount).word;
    return {
      content: (
        <>
          {verb} <StatusCount value={matchedCount} /> из <StatusCount value={sourceCount} />
        </>
      ),
      ariaLabel: `${verb} ${matchedCount} из ${sourceCount} ${sourceWord}`,
    };
  }

  return {
    content: (
      <>
        {verb} <StatusCount value={matchedCount} />
        {'\u00A0'}
        {word}
      </>
    ),
    ariaLabel: `${verb} ${matchedCount} ${word}`,
  };
};

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
  emptyText = 'Ничего не найдено.',
  itemsPerPage: itemsPerPageProp = DEFAULT_ITEMS_PER_PAGE,
  containerClassName,
  gridClassName,
  searchResetKey = 0,
}) => {
  const searchId = useId();
  const statusId = useId();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortMode, setSortMode] = useState(SORT_MODES.DEFAULT);
  const [itemsPerPage, setItemsPerPage] = useState(() => readStoredItemsPerPage(itemsPerPageProp));
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [paginationStuck, setPaginationStuck] = useState(false);
  const debounceTimerRef = useRef(null);
  const paginationStuckObserverRef = useRef(null);

  const setPaginationSentinelNode = (node) => {
    if (paginationStuckObserverRef.current) {
      paginationStuckObserverRef.current.disconnect();
      paginationStuckObserverRef.current = null;
    }

    if (!node) {
      setPaginationStuck(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setPaginationStuck(!entry.isIntersecting);
      },
      { threshold: 0 }
    );
    observer.observe(node);
    paginationStuckObserverRef.current = observer;
  };

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

  useEffect(
    () => () => {
      if (paginationStuckObserverRef.current) {
        paginationStuckObserverRef.current.disconnect();
        paginationStuckObserverRef.current = null;
      }
    },
    []
  );

  const normalizedSearchQuery = useMemo(
    () => debouncedQuery.trim().toLowerCase(),
    [debouncedQuery]
  );

  const isSearchPending = searchQuery.trim() !== '' && searchQuery !== debouncedQuery;

  useEffect(() => {
    setCurrentPage(1);
  }, [items, sortMode, debouncedQuery, itemsPerPage]);

  const safeItems = items ?? null;

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

  const handleSearchKeyDown = (event) => {
    if (event.key !== 'Escape' || searchQuery === '') return;
    event.preventDefault();
    handleSearchClear();
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
  const hasAppliedQuery = Boolean(normalizedSearchQuery);
  const showSearchClear = searchQuery.trim() !== '' && !isSearchPending;
  const isTitleFilterEmpty = hasSourceItems && !hasVisibleItems && hasAppliedQuery;
  const listStatus = hasSourceItems
    ? buildListStatus(totalItems, safeItems.length, hasAppliedQuery)
    : null;

  const searchSuffix = (
    <span className="list-toolbar__search-suffix">
      {isSearchPending ? (
        <span className="list-toolbar__search-loading" aria-hidden="true">
          <LoadingIcon className="list-toolbar__search-loading-icon" />
        </span>
      ) : showSearchClear ? (
        <button
          type="button"
          className="list-toolbar__search-clear"
          aria-label="Очистить поиск"
          onClick={handleSearchClear}
          onMouseDown={(event) => event.preventDefault()}
        >
          <ClearIcon className="list-toolbar__search-clear-icon" aria-hidden />
        </button>
      ) : null}
    </span>
  );

  return (
    <Flex className={containerClassName} vertical>
      {hasSourceItems && (
        <div
          className={[
            'list-toolbar',
            hasAppliedQuery ? 'list-toolbar--has-query' : '',
            isSearchPending ? 'list-toolbar--filtering' : '',
            searchQuery.trim() ? 'list-toolbar--typing' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="list-toolbar__search-group">
            <Input
              id={searchId}
              className="list-toolbar__search"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder="Поиск по названию"
              aria-label="Поиск по названию"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="search"
              aria-busy={isSearchPending || undefined}
              aria-describedby={listStatus ? statusId : undefined}
              prefix={
                <span className="list-toolbar__search-prefix" aria-hidden="true">
                  <SearchIcon className="list-toolbar__search-prefix-icon" />
                </span>
              }
              suffix={searchSuffix}
            />
            <p
              id={statusId}
              className={`list-toolbar__status${listStatus ? '' : ' is-empty'}`}
              role="status"
              aria-live="polite"
              aria-label={listStatus?.ariaLabel}
            >
              {listStatus?.content ?? null}
            </p>
          </div>
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
                    className="list-toolbar__icon-btn list-toolbar__icon-btn--group-start"
                    aria-label="Сортировка"
                    aria-haspopup="menu"
                  >
                    <SortIcon className="list-toolbar__icon" aria-hidden />
                  </button>
                </Dropdown>
              </span>
            </HoverTooltip>
            <HoverTooltip title="На странице" placement="bottom">
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
                    className="list-toolbar__icon-btn list-toolbar__icon-btn--group-end"
                    aria-label="На странице"
                    aria-haspopup="menu"
                  >
                    <PageSizeIcon className="list-toolbar__icon" aria-hidden />
                  </button>
                </Dropdown>
              </span>
            </HoverTooltip>
          </div>
        </div>
      )}
      {hasVisibleItems ? (
        <div
          className={[
            'paginated-list-results',
            totalPages > 1 ? 'paginated-list-results--paged' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className={`paginated-list-results__grid ${gridClassName}`}>
            {currentPageData.map((item) => renderCard(item, { isClientMode }))}
          </div>
          {totalPages > 1 && (
            <>
              <nav
                className={[
                  'pagination-container',
                  paginationStuck ? 'is-stuck' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label="Страницы"
              >
                <Pagination
                  current={currentPage}
                  total={totalItems}
                  pageSize={itemsPerPage}
                  onChange={handlePageChange}
                  showSizeChanger={false}
                  size="small"
                />
              </nav>
              <div
                ref={setPaginationSentinelNode}
                className="pagination-container__sentinel"
                aria-hidden="true"
              />
            </>
          )}
        </div>
      ) : isTitleFilterEmpty ? (
        <div className="list-filter-empty" role="status">
          <p className="list-filter-empty__text">Нет совпадений</p>
          <Button
            type="default"
            className="list-filter-empty__clear"
            onClick={handleSearchClear}
          >
            Очистить поиск
          </Button>
        </div>
      ) : (
        <Flex className="empty-state" justify="center" align="center">
          <Empty description={emptyText} />
        </Flex>
      )}
    </Flex>
  );
};

export default PaginatedCardsList;
