import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Drawer, Empty, Input, Select } from 'antd';
import {
  catalogSearchSelectProps,
  useCatalogSelectCloseOnMouseLeave,
} from '../catalogSearchSelectProps';
import { CATALOG_SEARCH_LAYOUT } from '../useCatalogSearchFormLayout';
import { useVisualViewportBottomInset } from '../useVisualViewportBottomInset';
import './CatalogBrandFilterControl.scss';

const { Option } = Select;

const BRAND_ARIA_LABEL = 'Бренд';
const CLEAR_OR_TAG_REMOVE_SELECTOR =
  '.ant-select-clear, .ant-select-selection-item-remove';

const toBrandList = (value) => (Array.isArray(value) ? value : []);

const getBrandSheetContainer = () =>
  document.getElementById('root') || document.body;

const isClearOrTagRemoveTarget = (target) => {
  if (!target || typeof target.closest !== 'function') return false;
  return Boolean(target.closest(CLEAR_OR_TAG_REMOVE_SELECTOR));
};

function CatalogBrandDesktopSelect({
  value,
  onChange,
  options,
  loading,
  placeholder,
}) {
  const brandSelectCloseOnMouseLeave = useCatalogSelectCloseOnMouseLeave();
  const selected = toBrandList(value);
  const handleChange = (next) => onChange?.(toBrandList(next));

  return (
    <Select
      {...catalogSearchSelectProps}
      {...brandSelectCloseOnMouseLeave}
      mode="multiple"
      value={selected}
      onChange={handleChange}
      placeholder={placeholder}
      aria-label={BRAND_ARIA_LABEL}
      allowClear
      maxTagCount="responsive"
      optionFilterProp="children"
      loading={loading}
    >
      {options.map((brand) => (
        <Option key={brand} value={brand}>
          {brand}
        </Option>
      ))}
    </Select>
  );
}

function CatalogBrandSheetControl({
  value,
  onChange,
  options,
  loading,
  placeholder,
  isActive,
}) {
  const triggerRef = useRef(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = toBrandList(value);
  const handleChange = (next) => onChange?.(toBrandList(next));
  const imeInset = useVisualViewportBottomInset(sheetOpen && isActive);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    const combobox = triggerRef.current?.querySelector('[role="combobox"]');
    combobox?.focus?.({ preventScroll: true });
  }, []);

  const openSheet = useCallback(() => {
    if (!isActive) return;
    setSheetOpen(true);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) setSheetOpen(false);
  }, [isActive]);

  useEffect(() => {
    if (!sheetOpen) setQuery('');
  }, [sheetOpen]);

  useEffect(() => {
    const root = triggerRef.current;
    if (!root) return undefined;
    const input = root.querySelector('input.ant-select-selection-search-input');
    if (!input) return undefined;
    input.setAttribute('readonly', 'readonly');
    input.setAttribute('inputmode', 'none');
    input.setAttribute('autocomplete', 'off');
    return undefined;
  }, [loading, options.length]);

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((brand) =>
      String(brand).toLowerCase().includes(needle)
    );
  }, [options, query]);

  const handleTriggerMouseDown = (event) => {
    if (isClearOrTagRemoveTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openSheet();
  };

  const handleTriggerKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (isClearOrTagRemoveTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openSheet();
  };

  const handleSearchKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.blur();
  };

  const handleSearchPressEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.target?.blur?.();
  };

  return (
    <>
      <div
        ref={triggerRef}
        className="catalog-brand-filter-control__trigger"
        onMouseDown={handleTriggerMouseDown}
        onKeyDown={handleTriggerKeyDown}
      >
        <Select
          mode="multiple"
          open={false}
          showSearch={false}
          value={selected}
          onChange={handleChange}
          onOpenChange={() => {}}
          placeholder={placeholder}
          aria-label={BRAND_ARIA_LABEL}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          allowClear
          maxTagCount="responsive"
          loading={loading}
        />
      </div>
      {sheetOpen && isActive ? (
        <Drawer
          title={BRAND_ARIA_LABEL}
          placement="bottom"
          open
          onClose={closeSheet}
          destroyOnHidden
          destroyOnClose
          maskClosable
          keyboard
          autoFocus
          focusTriggerAfterClose
          push={false}
          height="min(80dvh, 640px)"
          getContainer={getBrandSheetContainer}
          rootClassName="catalog-brand-sheet"
          rootStyle={{
            position: 'fixed',
            paddingBottom: imeInset,
          }}
          classNames={{
            body: 'catalog-brand-sheet__body',
            footer: 'catalog-brand-sheet__footer',
          }}
          footer={(
            <Button type="primary" block size="large" onClick={closeSheet}>
              Готово
            </Button>
          )}
        >
          <div className="catalog-brand-sheet__content">
            <Input
              type="search"
              allowClear
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              onPressEnter={handleSearchPressEnter}
              placeholder="Поиск"
              aria-label="Поиск бренда"
              autoComplete="off"
              enterKeyHint="search"
            />
            <div className="catalog-brand-sheet__list">
              {filteredOptions.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Ничего не найдено"
                />
              ) : (
                <Checkbox.Group
                  className="catalog-brand-sheet__options"
                  value={selected}
                  onChange={handleChange}
                >
                  {filteredOptions.map((brand) => (
                    <Checkbox key={brand} value={brand}>
                      {brand}
                    </Checkbox>
                  ))}
                </Checkbox.Group>
              )}
            </div>
          </div>
        </Drawer>
      ) : null}
    </>
  );
}

function CatalogBrandFilterControl({
  layout,
  options = [],
  loading = false,
  placeholder,
  isActive = true,
  value,
  onChange,
}) {
  const brandOptions = Array.isArray(options) ? options : [];

  if (layout === CATALOG_SEARCH_LAYOUT.HORIZONTAL) {
    return (
      <CatalogBrandDesktopSelect
        value={value}
        onChange={onChange}
        options={brandOptions}
        loading={loading}
        placeholder={placeholder}
      />
    );
  }

  return (
    <CatalogBrandSheetControl
      value={value}
      onChange={onChange}
      options={brandOptions}
      loading={loading}
      placeholder={placeholder}
      isActive={isActive}
    />
  );
}

export default CatalogBrandFilterControl;
