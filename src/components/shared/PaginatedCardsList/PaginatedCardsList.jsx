import React, { useEffect, useMemo, useState } from 'react';
import { SortDescendingOutlined } from '@ant-design/icons';
import { Alert, Dropdown, Empty, Flex, Input, Pagination } from 'antd';
import './PaginatedCardsList.scss';

const DEFAULT_ITEMS_PER_PAGE = 21;

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

const getSortablePrice = (item) => {
  const raw = item?.sellingPrice ?? item?.price ?? item?.cost ?? null;
  const num = typeof raw === 'number' ? raw : raw != null ? Number(String(raw).replace(',', '.')) : NaN;
  return Number.isFinite(num) ? num : null;
};

const getSortableText = (item) => String(item?.title ?? item?.brand ?? '').trim().toLocaleLowerCase('ru');

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
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  containerClassName,
  gridClassName,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortMode, setSortMode] = useState(SORT_MODES.DEFAULT);
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedSearchQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [items, sortMode, searchQuery]);

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

  return (
    <Flex className={containerClassName} vertical>
      {hasSourceItems && (
        <Flex className="list-toolbar" align="flex-end" wrap="wrap">
          <Input
            className="list-toolbar__search"
            allowClear
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            prefix="Поиск:"
            placeholder="По названию"
          />
          <Dropdown
            menu={{
              items: SORT_MENU_ITEMS,
              selectedKeys: [sortMode],
              onClick: ({ key }) => setSortMode(key),
            }}
            trigger={['click']}
            overlayClassName="catalog-search-select-dropdown"
          >
            <SortDescendingOutlined
              className="list-toolbar__sort-icon"
              role="button"
              aria-label="Сортировка"
            />
          </Dropdown>
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