import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Form, Select, Button, Radio, Checkbox, Alert } from 'antd';
import { ReactComponent as SunIcon } from '../../icons/Sun.svg';
import { ReactComponent as SnowIcon } from '../../icons/Snow.svg';
import { ReactComponent as ResetIcon } from '../../icons/Reset.svg';
import { ReactComponent as SearchIcon } from '../../icons/Search.svg';
import indexedDBService from '../../services/indexedDBService';
import CatalogItemModalWindow from '../shared/CatalogItemModalWindow/CatalogItemModalWindow';
import CatalogItemCard from '../shared/CatalogItemCard/CatalogItemCard';
import PaginatedCardsList from '../shared/PaginatedCardsList/PaginatedCardsList';
import CatalogShowcase from '../shared/CatalogShowcase';
import CatalogSearchEmptyHint from '../shared/CatalogShowcase/CatalogSearchEmptyHint';
import CatalogResultsFade from '../shared/CatalogResultsFade/CatalogResultsFade';
import HoverTooltip from '../shared/HoverTooltip';
import SupplierFilterSelect from '../shared/SupplierFilterSelect';
import {
  catalogSearchSelectProps,
  useCatalogSelectCloseOnMouseLeave,
} from '../shared/catalogSearchSelectProps';
import {
  CATALOG_SEARCH_LAYOUT,
  useCatalogSearchFormLayout,
} from '../shared/useCatalogSearchFormLayout';
import { useAppShell } from '../../app/AppShellContext';
import { scrollWindowToTop } from '../../utils/scrollWindowToTop';
import { mapTireFormValuesToSearchFilters } from '../../catalog/search/searchFormFilters';
import {
  SEARCH_FACET_DEBOUNCE_MS,
  TIRE_FACET_IRRELEVANT_FIELDS,
  beginCatalogSearchRequest,
  clearDebounced,
  didOnlyIrrelevantSearchFieldsChange,
  invalidateCatalogSearchRequest,
  scheduleDebounced,
  settleCatalogSearchLoading,
  withCatalogSearchTimeout,
} from '../../catalog/search/searchFormCascade';
import {
  appLog,
  isExpectedOperationalError,
} from '../../utils/appLog';
import './TiresSearchParameters.scss';

const { Option } = Select;

const DEFAULT_SEASON = 's';

const isActiveFilterValue = (value) =>
  value !== undefined && value !== null && value !== '';

const optionIncludesNumeric = (options, value) =>
  Array.isArray(options) && options.some((option) => Number(option) === Number(value));

const optionIncludesDiameter = (options, value) =>
  Array.isArray(options) && options.some((option) => String(option) === String(value));

const TiresSearchParameters = memo(({ isActive = true }) => {
  const {
    clientMode: isClientMode,
    catalogDataVersion = 0,
    workspaceResetKey = 'guest',
    catalogSurfaceHold = false,
  } = useAppShell();
  const [form] = Form.useForm();
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [errorSearch, setErrorSearch] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [availableWidths, setAvailableWidths] = useState([]);
  const [availableProfiles, setAvailableProfiles] = useState([]);
  const [availableDiameters, setAvailableDiameters] = useState([]);
  const [availableBrands, setAvailableBrands] = useState([]);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const rootRef = useRef(null);
  const searchFormLayout = useCatalogSearchFormLayout(rootRef);
  const isHorizontalLayout =
    searchFormLayout === CATALOG_SEARCH_LAYOUT.HORIZONTAL;
  const fieldPlaceholder = (name) => (isHorizontalLayout ? name : 'Все');
  const loadRequestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);
  const foregroundRequestIdRef = useRef(0);
  const loadingSearchRef = useRef(false);
  const optionsReadyRef = useRef(false);
  const cascadeTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const workspaceKeyRef = useRef(workspaceResetKey);
  workspaceKeyRef.current = workspaceResetKey;
  /** Пока панель спала и catalog/workspace устарел — нужен один catch-up при активации. */
  const needsCatchUpRef = useRef(true);
  const isActiveRef = useRef(false);

  const setSearchLoading = (value) => {
    loadingSearchRef.current = value;
    setLoadingSearch(value);
  };
  const brandSelectCloseOnMouseLeave = useCatalogSelectCloseOnMouseLeave();
  const selectedSeason = Form.useWatch('season', form) ?? DEFAULT_SEASON;
  const showSpikesFilter = selectedSeason === 'w';

  const widthOptions = useMemo(() => {
    if (!Array.isArray(availableWidths)) return [];

    // In summer mode start dropdown from 135 for faster common-size access.
    if (selectedSeason !== 's') return availableWidths;

    const sortedWidths = [...availableWidths].sort((a, b) => Number(a) - Number(b));
    const splitIndex = sortedWidths.findIndex((width) => Number(width) >= 135);
    if (splitIndex === -1) return sortedWidths;

    return [...sortedWidths.slice(splitIndex), ...sortedWidths.slice(0, splitIndex)];
  }, [availableWidths, selectedSeason]);

  useEffect(() => {
    workspaceKeyRef.current = workspaceResetKey;
    loadRequestIdRef.current += 1;
    invalidateCatalogSearchRequest({
      searchRequestIdRef,
      foregroundRequestIdRef,
      setLoadingSearch: setSearchLoading,
    });
    optionsReadyRef.current = false;
    clearDebounced(cascadeTimerRef);
    setLoadingOptions(false);
    setErrorSearch(null);
    setSearchResults(null);
    setAvailableWidths([]);
    setAvailableProfiles([]);
    setAvailableDiameters([]);
    setAvailableBrands([]);
    setAvailableSuppliers([]);
    form.resetFields();
  }, [form, workspaceResetKey]);

  useEffect(() => {
    // StrictMode (npm start) делает setup → cleanup → setup и сохраняет тот же ref.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadRequestIdRef.current += 1;
      searchRequestIdRef.current += 1;
      clearDebounced(cascadeTimerRef);
    };
  }, []);

  const buildFiltersFromFormValues = (allValues = {}) => {
    const filters = { season: allValues.season ?? DEFAULT_SEASON };
    if (isActiveFilterValue(allValues.width)) filters.width = allValues.width;
    if (isActiveFilterValue(allValues.profile)) filters.profile = allValues.profile;
    if (isActiveFilterValue(allValues.diameter)) filters.diameter = allValues.diameter;
    if (allValues.spikes !== undefined && allValues.spikes !== null) filters.spikes = allValues.spikes;
    return filters;
  };

  useEffect(() => {
    if (!isActive) {
      // Уже спали и сменился catalog/workspace → пометить устаревшим.
      // Первый уход в sleep (was active) не помечает stale сам по себе.
      if (!isActiveRef.current) {
        needsCatchUpRef.current = true;
      }
      isActiveRef.current = false;
      return;
    }

    const justActivated = !isActiveRef.current;
    isActiveRef.current = true;

    // Keep-alive re-entry без stale: не трогаем IDB (фильтры/результаты на месте).
    if (justActivated && !needsCatchUpRef.current) {
      return;
    }

    needsCatchUpRef.current = false;
    loadAvailableParameters(buildFiltersFromFormValues(form.getFieldsValue()));
    // Перезапуск активного поиска без сброса фильтров (после cloud/local обновления IDB)
    if (searchResults !== null && !loadingSearchRef.current) {
      handleSearch(form.getFieldsValue(), { background: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogDataVersion, workspaceResetKey, isActive]);

  const loadAvailableParameters = async (filters = {}) => {
    const filtersWithSeason = { season: filters.season ?? DEFAULT_SEASON, ...filters };
    const requestId = ++loadRequestIdRef.current;
    const requestedWorkspaceKey = workspaceResetKey;

    if (!optionsReadyRef.current) {
      setLoadingOptions(true);
    }

    try {
      const options = await indexedDBService.getAvailableParameterOptions(filtersWithSeason);

      if (
        requestId !== loadRequestIdRef.current ||
        requestedWorkspaceKey !== workspaceKeyRef.current
      ) {
        return null;
      }

      setAvailableWidths(options.widths);
      setAvailableProfiles(options.profiles);
      setAvailableDiameters(options.diameters);
      setAvailableBrands(options.brands);
      setAvailableSuppliers(options.suppliers);
      optionsReadyRef.current = true;

      return options;
    } catch (error) {
      if (!isExpectedOperationalError(error)) {
        appLog.warn({
          code: 'search.options_failed',
          domain: 'search',
          message: 'Failed to load tire search options',
          error,
          context: { kind: 'tires' },
        });
      }
      // Оставляем предыдущие опции, чтобы UI не моргал пустыми списками
      return null;
    } finally {
      if (
        requestId === loadRequestIdRef.current &&
        requestedWorkspaceKey === workspaceKeyRef.current
      ) {
        setLoadingOptions(false);
      }
    }
  };

  const softInvalidateIncompatibleSizeValues = async (values) => {
    let currentValues = { ...values };
    let options = await loadAvailableParameters(buildFiltersFromFormValues(currentValues));
    if (!options) return null;

    const incompatibleReset = {};
    if (isActiveFilterValue(currentValues.width) && !optionIncludesNumeric(options.widths, currentValues.width)) {
      incompatibleReset.width = undefined;
    }
    if (isActiveFilterValue(currentValues.profile) && !optionIncludesNumeric(options.profiles, currentValues.profile)) {
      incompatibleReset.profile = undefined;
    }
    if (isActiveFilterValue(currentValues.diameter) && !optionIncludesDiameter(options.diameters, currentValues.diameter)) {
      incompatibleReset.diameter = undefined;
    }

    if (Object.keys(incompatibleReset).length === 0) {
      return options;
    }

    form.setFieldsValue(incompatibleReset);
    currentValues = { ...currentValues, ...incompatibleReset };
    return loadAvailableParameters(buildFiltersFromFormValues(currentValues));
  };

  const handleSearch = async (values, { background = false } = {}) => {
    const requestId = beginCatalogSearchRequest({
      searchRequestIdRef,
      foregroundRequestIdRef,
      background,
    });
    const requestedWorkspaceKey = workspaceResetKey;
    const isCurrentRequest = () =>
      mountedRef.current &&
      requestId === searchRequestIdRef.current &&
      requestedWorkspaceKey === workspaceKeyRef.current;

    if (!background) {
      setSearchResetKey((key) => key + 1);
      setSearchLoading(true);
      setErrorSearch(null);
    }

    try {
      const searchParams = mapTireFormValuesToSearchFilters(values);
      const dbResults = await withCatalogSearchTimeout(
        indexedDBService.searchTires(searchParams)
      );
      if (!isCurrentRequest()) {
        return;
      }
      setSearchResults(dbResults);
      if (background) {
        setErrorSearch(null);
      }
    } catch (err) {
      if (!isCurrentRequest()) {
        return;
      }
      if (!isExpectedOperationalError(err)) {
        appLog.error({
          code: 'search.failed',
          domain: 'search',
          message: 'Tire search failed',
          error: err,
          context: { kind: 'tires', background },
        });
      }
      if (!background && !isExpectedOperationalError(err)) {
        setErrorSearch(err.message);
      }
    } finally {
      settleCatalogSearchLoading({
        background,
        requestId,
        searchRequestIdRef,
        foregroundRequestIdRef,
        mountedRef,
        requestedWorkspaceKey,
        workspaceKeyRef,
        setLoadingSearch: setSearchLoading,
      });
    }
  };

  const handleFormChange = (changedValues, allValues) => {
    let valuesForFilters = allValues;

    if (changedValues.season !== undefined) {
      const isWinter = changedValues.season === 'w';

      // Keep size/brand/supplier/etc. — only sync spikes for winter UI.
      const spikesUpdate = {
        spikes: isWinter
          ? (allValues.spikes === undefined ? null : allValues.spikes)
          : undefined,
      };
      form.setFieldsValue(spikesUpdate);
      valuesForFilters = { ...allValues, ...spikesUpdate, season: changedValues.season };
    }

    if (
      !didOnlyIrrelevantSearchFieldsChange(
        changedValues,
        TIRE_FACET_IRRELEVANT_FIELDS
      )
    ) {
      const snapshot = valuesForFilters;
      scheduleDebounced(cascadeTimerRef, SEARCH_FACET_DEBOUNCE_MS, () => {
        softInvalidateIncompatibleSizeValues(snapshot);
      });
    }

    if (
      (changedValues.onlyAmountFrom4 !== undefined || changedValues.onlyRunflat !== undefined) &&
      searchResults !== null &&
      !loadingSearch
    ) {
      form.submit();
    }
  };

  const handleResetFilters = () => {
    clearDebounced(cascadeTimerRef);
    invalidateCatalogSearchRequest({
      searchRequestIdRef,
      foregroundRequestIdRef,
      setLoadingSearch: setSearchLoading,
    });
    setSearchResetKey((key) => key + 1);
    setErrorSearch(null);
    setSearchResults(null);
    form.resetFields();
    loadAvailableParameters({ season: DEFAULT_SEASON });
  };

  const renderCatalogCard = (tire, { isClientMode: clientMode }) => (
    <CatalogItemCard
      key={tire.id}
      item={tire}
      category="tyres"
      isClientMode={clientMode}
      cardClassName="item-card"
      ModalComponent={CatalogItemModalWindow}
      modalItemPropName="item"
    />
  );

  const handleShowcaseChipClick = (chip) => {
    const nextValues = {
      ...form.getFieldsValue(),
      width: chip.width,
      profile: chip.profile,
      diameter: chip.diameter,
    };
    form.setFieldsValue({
      width: chip.width,
      profile: chip.profile,
      diameter: chip.diameter,
    });
    scrollWindowToTop();
    handleSearch(nextValues);
  };

  const showShowcase = searchResults === null;
  const showSearchEmpty =
    Array.isArray(searchResults) && searchResults.length === 0 && !loadingSearch;
  const showSearchResults =
    Array.isArray(searchResults) && searchResults.length > 0;
  const resultsViewKey = showShowcase
    ? 'showcase'
    : showSearchEmpty
      ? 'empty'
      : showSearchResults
        ? 'results'
        : 'none';

  return (
    <div
      ref={rootRef}
      className="tires-search-parameters"
      data-layout={searchFormLayout}
    >
      <Form
        form={form}
        layout={isHorizontalLayout ? 'horizontal' : 'vertical'}
        requiredMark={false}
        onFinish={handleSearch}
        onValuesChange={handleFormChange}
        initialValues={{
          season: 's',
          spikes: null,
          width: undefined,
          profile: undefined,
          diameter: undefined,
          brand: [],
          supplier: undefined,
          onlyAmountFrom4: false,
          onlyRunflat: false,
        }}
        className="search-form"
        aria-label="Параметры поиска шин"
      >
        <div className="search-form__toolbar">
          <div className="search-form__row">
            <div className="filter-group filter-group--season">
              <Form.Item name="season" className="form-item-season">
                <Radio.Group aria-label="Сезон">
                  <Radio value="s" className="radio-summer">
                    <span className="season-radio-label">
                      <SunIcon className="season-radio-icon" aria-hidden />
                      Летние
                    </span>
                  </Radio>
                  <Radio value="w" className="radio-winter">
                    <span className="season-radio-label">
                      <SnowIcon className="season-radio-icon" aria-hidden />
                      Зимние
                    </span>
                  </Radio>
                </Radio.Group>
              </Form.Item>
            </div>

            {showSpikesFilter ? (
              <div className="filter-group filter-group--spikes">
                <Form.Item
                  name="spikes"
                  label={isHorizontalLayout ? undefined : 'Шипы'}
                  className="form-item-spikes"
                  getValueProps={(value) => ({
                    value:
                      value === true ? 'yes' : value === false ? 'no' : 'all',
                  })}
                  getValueFromEvent={(value) => {
                    if (value === 'yes') return true;
                    if (value === 'no') return false;
                    return null;
                  }}
                >
                  <Select
                    {...catalogSearchSelectProps}
                    allowClear
                    placeholder="Все"
                    aria-label="Шипы"
                    className="filter-select--spikes"
                    options={[
                      { value: 'all', label: 'Все' },
                      { value: 'yes', label: 'Шипы' },
                      { value: 'no', label: 'Без шипов' },
                    ]}
                  />
                </Form.Item>
              </div>
            ) : null}

            <div className="filter-group filter-group--size" role="group" aria-label="Размер шины">
              <Form.Item name="width" label={isHorizontalLayout ? undefined : 'Ширина, мм'} className="form-item">
                <Select
                  {...catalogSearchSelectProps}
                  allowClear
                  placeholder={fieldPlaceholder('Ширина')}
                  aria-label="Ширина"
                  loading={loadingOptions}
                  className="filter-select--size"
                >
                  {widthOptions.map((width) => (
                    <Option key={width} value={width}>
                      {width}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="profile" label={isHorizontalLayout ? undefined : 'Профиль'} className="form-item">
                <Select
                  {...catalogSearchSelectProps}
                  allowClear
                  placeholder={fieldPlaceholder('Профиль')}
                  aria-label="Профиль"
                  loading={loadingOptions}
                  className="filter-select--size"
                >
                  {availableProfiles.map((profile) => (
                    <Option key={profile} value={profile}>
                      {profile === 0 ? '0 (груз.)' : profile}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="diameter" label={isHorizontalLayout ? undefined : 'Диаметр'} className="form-item">
                <Select
                  {...catalogSearchSelectProps}
                  allowClear
                  placeholder={fieldPlaceholder('Диаметр')}
                  aria-label="Диаметр"
                  loading={loadingOptions}
                  className="filter-select--size"
                >
                  {availableDiameters.map((diameter) => (
                    <Option key={diameter} value={diameter}>
                      {diameter}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <div className="filter-group filter-group--brand">
              <Form.Item name="brand" label={isHorizontalLayout ? undefined : 'Бренд'} className="form-item form-item-brand">
                <Select
                  {...catalogSearchSelectProps}
                  {...brandSelectCloseOnMouseLeave}
                  mode="multiple"
                  placeholder={fieldPlaceholder('Бренд')}
                  aria-label="Бренд"
                  allowClear
                  maxTagCount="responsive"
                  optionFilterProp="children"
                  loading={loadingOptions}
                >
                  {availableBrands.map((brand) => (
                    <Option key={brand} value={brand}>
                      {brand}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <div className="filter-group filter-group--supplier">
              <Form.Item name="supplier" label={isHorizontalLayout ? undefined : 'Поставщик'} className="form-item form-item-supplier">
                <SupplierFilterSelect
                  isClientMode={isClientMode}
                  loading={loadingOptions}
                  options={availableSuppliers}
                />
              </Form.Item>
            </div>

            <div className="filter-group filter-group--checks">
              <Form.Item name="onlyAmountFrom4" valuePropName="checked" className="form-item form-item-check">
                <Checkbox>от 4 шт</Checkbox>
              </Form.Item>
              <Form.Item name="onlyRunflat" valuePropName="checked" className="form-item form-item-check">
                <Checkbox>RunFlat</Checkbox>
              </Form.Item>
            </div>

            <div className="filter-group filter-group--actions">
              {isHorizontalLayout ? (
                <>
                  <HoverTooltip title="Найти">
                    <Button
                      type="primary"
                      htmlType="submit"
                      className="filter-action-btn filter-action-btn--search"
                      icon={<SearchIcon aria-hidden />}
                      loading={loadingSearch}
                      aria-label="Найти"
                    />
                  </HoverTooltip>
                  <HoverTooltip title="Сбросить фильтры">
                    <Button
                      htmlType="button"
                      className="filter-action-btn filter-action-btn--reset"
                      icon={<ResetIcon aria-hidden />}
                      onClick={handleResetFilters}
                      aria-label="Сбросить фильтры"
                    />
                  </HoverTooltip>
                </>
              ) : (
                <>
                  <Button
                    type="primary"
                    htmlType="submit"
                    className="filter-action-btn filter-action-btn--search"
                    icon={<SearchIcon aria-hidden />}
                    loading={loadingSearch}
                    aria-label="Найти"
                  >
                    Найти
                  </Button>
                  <Button
                    htmlType="button"
                    className="filter-action-btn filter-action-btn--reset"
                    icon={<ResetIcon aria-hidden />}
                    onClick={handleResetFilters}
                    aria-label="Сбросить фильтры"
                  >
                    Сбросить
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </Form>

      <div className="catalog-search-main">
        {errorSearch ? (
          <Alert
            data-testid="search-error"
            message="Ошибка поиска"
            description={errorSearch}
            type="error"
            showIcon
            className="error-alert"
          />
        ) : null}

        <CatalogResultsFade viewKey={resultsViewKey} hold={catalogSurfaceHold}>
          {showShowcase && isActive ? (
            <CatalogShowcase
              kind="tires"
              renderCard={renderCatalogCard}
              onChipClick={handleShowcaseChipClick}
            />
          ) : null}

          {showSearchEmpty ? (
            <CatalogSearchEmptyHint
              kind="tires"
              onResetFilters={handleResetFilters}
              onChipClick={handleShowcaseChipClick}
            />
          ) : null}

          {showSearchResults ? (
            <PaginatedCardsList
              items={searchResults}
              isClientMode={isClientMode}
              searchResetKey={searchResetKey}
              containerClassName="items-list-container"
              gridClassName="items-grid"
              onResetFilters={handleResetFilters}
              renderCard={renderCatalogCard}
            />
          ) : null}
        </CatalogResultsFade>
      </div>
    </div>
  );
});

export default TiresSearchParameters;
