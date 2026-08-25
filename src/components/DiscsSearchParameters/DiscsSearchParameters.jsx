import React, { useState, useEffect, useRef, memo } from 'react';
import { Form, Select, Button, Checkbox, Alert } from 'antd';
import { ReactComponent as ResetIcon } from '../../icons/Reset.svg';
import { ReactComponent as SearchIcon } from '../../icons/Search.svg';
import indexedDBService from '../../services/indexedDBService';
import CatalogItemModalWindow from '../shared/CatalogItemModalWindow/CatalogItemModalWindow';
import CatalogItemCard from '../shared/CatalogItemCard/CatalogItemCard';
import PaginatedCardsList from '../shared/PaginatedCardsList/PaginatedCardsList';
import CatalogShowcase from '../shared/CatalogShowcase';
import CatalogSearchEmptyHint from '../shared/CatalogShowcase/CatalogSearchEmptyHint';
import HoverTooltip from '../shared/HoverTooltip';
import SupplierFilterSelect from '../shared/SupplierFilterSelect';
import {
  catalogSearchSelectProps,
  useCatalogSelectCloseOnMouseLeave,
} from '../shared/catalogSearchSelectProps';
import { useAppShell } from '../../app/AppShellContext';
import { mapDiscFormValuesToSearchFilters } from '../../catalog/search/searchFormFilters';
import {
  DISC_FACET_IRRELEVANT_FIELDS,
  SEARCH_FACET_DEBOUNCE_MS,
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
import './DiscsSearchParameters.scss';

const { Option } = Select;

const isActiveFilterValue = (value) =>
  value !== undefined && value !== null && value !== '';

const optionIncludesNumeric = (options, value) =>
  Array.isArray(options) && options.some((option) => Number(option) === Number(value));

const optionIncludesString = (options, value) =>
  Array.isArray(options) && options.some((option) => String(option) === String(value));

const DiscsSearchParameters = memo(({ isActive = true }) => {
  const {
    clientMode: isClientMode,
    catalogDataVersion = 0,
    workspaceResetKey = 'guest',
  } = useAppShell();
  const [form] = Form.useForm();
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [errorSearch, setErrorSearch] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [availableBrands, setAvailableBrands] = useState([]);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [availableDiameters, setAvailableDiameters] = useState([]);
  const [availableWidths, setAvailableWidths] = useState([]);
  const [availableCb, setAvailableCb] = useState([]);
  const [availableEt, setAvailableEt] = useState([]);
  const [availablePcd, setAvailablePcd] = useState([]);
  const [availablePn, setAvailablePn] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const brandSelectCloseOnMouseLeave = useCatalogSelectCloseOnMouseLeave();
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

  useEffect(() => {
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
    setAvailableBrands([]);
    setAvailableSuppliers([]);
    setAvailableDiameters([]);
    setAvailableWidths([]);
    setAvailableCb([]);
    setAvailableEt([]);
    setAvailablePcd([]);
    setAvailablePn([]);
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
    const filters = {};
    if (isActiveFilterValue(allValues.supplier)) filters.supplier = allValues.supplier;
    if (isActiveFilterValue(allValues.diameter)) filters.diameter = allValues.diameter;
    if (isActiveFilterValue(allValues.pcd)) filters.pcd = allValues.pcd;
    if (isActiveFilterValue(allValues.pn)) filters.pn = allValues.pn;
    if (isActiveFilterValue(allValues.diskType)) filters.diskType = allValues.diskType;
    if (isActiveFilterValue(allValues.widthFrom)) filters.widthFrom = allValues.widthFrom;
    if (isActiveFilterValue(allValues.widthTo)) filters.widthTo = allValues.widthTo;
    if (isActiveFilterValue(allValues.cbFrom)) filters.cbFrom = allValues.cbFrom;
    if (isActiveFilterValue(allValues.cbTo)) filters.cbTo = allValues.cbTo;
    if (isActiveFilterValue(allValues.etFrom)) filters.etFrom = allValues.etFrom;
    if (isActiveFilterValue(allValues.etTo)) filters.etTo = allValues.etTo;
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
    const requestId = ++loadRequestIdRef.current;
    const requestedWorkspaceKey = workspaceResetKey;

    if (!optionsReadyRef.current) {
      setLoadingOptions(true);
    }

    try {
      const options = await indexedDBService.getAvailableDiscParameterOptions(filters);

      if (
        requestId !== loadRequestIdRef.current ||
        requestedWorkspaceKey !== workspaceKeyRef.current
      ) {
        return null;
      }

      setAvailableBrands(options.brands);
      setAvailableSuppliers(options.suppliers);
      setAvailableDiameters(options.diameters);
      setAvailableWidths(options.widths);
      setAvailableCb(options.cb);
      setAvailableEt(options.et);
      setAvailablePcd(options.pcd);
      setAvailablePn(options.pn);
      optionsReadyRef.current = true;

      return options;
    } catch (error) {
      if (!isExpectedOperationalError(error)) {
        appLog.warn({
          code: 'search.options_failed',
          domain: 'search',
          message: 'Failed to load disc search options',
          error,
          context: { kind: 'discs' },
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

  const softInvalidateIncompatibleValues = async (values, optionsFilters = null) => {
    let currentValues = { ...values };
    const filtersForOptions = optionsFilters ?? buildFiltersFromFormValues(currentValues);
    let options = await loadAvailableParameters(filtersForOptions);
    if (!options) return null;

    const incompatibleReset = {};
    if (isActiveFilterValue(currentValues.diameter) && !optionIncludesString(options.diameters, currentValues.diameter)) {
      incompatibleReset.diameter = undefined;
    }
    if (isActiveFilterValue(currentValues.pn) && !optionIncludesNumeric(options.pn, currentValues.pn)) {
      incompatibleReset.pn = undefined;
    }
    if (isActiveFilterValue(currentValues.pcd) && !optionIncludesNumeric(options.pcd, currentValues.pcd)) {
      incompatibleReset.pcd = undefined;
    }
    if (isActiveFilterValue(currentValues.widthFrom) && !optionIncludesNumeric(options.widths, currentValues.widthFrom)) {
      incompatibleReset.widthFrom = undefined;
    }
    if (isActiveFilterValue(currentValues.widthTo) && !optionIncludesNumeric(options.widths, currentValues.widthTo)) {
      incompatibleReset.widthTo = undefined;
    }
    if (isActiveFilterValue(currentValues.cbFrom) && !optionIncludesNumeric(options.cb, currentValues.cbFrom)) {
      incompatibleReset.cbFrom = undefined;
    }
    if (isActiveFilterValue(currentValues.cbTo) && !optionIncludesNumeric(options.cb, currentValues.cbTo)) {
      incompatibleReset.cbTo = undefined;
    }
    if (isActiveFilterValue(currentValues.etFrom) && !optionIncludesNumeric(options.et, currentValues.etFrom)) {
      incompatibleReset.etFrom = undefined;
    }
    if (isActiveFilterValue(currentValues.etTo) && !optionIncludesNumeric(options.et, currentValues.etTo)) {
      incompatibleReset.etTo = undefined;
    }

    if (Object.keys(incompatibleReset).length === 0) {
      // After a type-only check, refresh cascade options with full current filters.
      if (optionsFilters) {
        return loadAvailableParameters(buildFiltersFromFormValues(currentValues));
      }
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
      const searchParams = mapDiscFormValuesToSearchFilters(values);
      const dbResults = await withCatalogSearchTimeout(
        indexedDBService.searchDiscs(searchParams)
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
          message: 'Disc search failed',
          error: err,
          context: { kind: 'discs', background },
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
    if (
      !didOnlyIrrelevantSearchFieldsChange(
        changedValues,
        DISC_FACET_IRRELEVANT_FIELDS
      )
    ) {
      const snapshot = allValues;
      const typeOnly =
        changedValues.diskType !== undefined
          ? { diskType: allValues.diskType }
          : null;
      scheduleDebounced(cascadeTimerRef, SEARCH_FACET_DEBOUNCE_MS, () => {
        if (typeOnly) {
          softInvalidateIncompatibleValues(snapshot, typeOnly);
        } else {
          softInvalidateIncompatibleValues(snapshot);
        }
      });
    }

    if (changedValues.onlyAmountFrom4 !== undefined && searchResults !== null && !loadingSearch) {
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
    loadAvailableParameters();
  };

  const renderCatalogCard = (disc, { isClientMode: clientMode }) => (
    <CatalogItemCard
      key={disc.id}
      item={disc}
      category="discs"
      isClientMode={clientMode}
      cardClassName="item-card"
      ModalComponent={CatalogItemModalWindow}
      modalItemPropName="item"
    />
  );

  const handleShowcaseChipClick = (chip) => {
    const patch = {
      diameter: chip.diameter,
      pn: chip.pn,
      pcd: chip.pcd,
      cbFrom: chip.cbFrom ?? chip.cb,
      cbTo: chip.cbTo ?? chip.cb,
    };
    const nextValues = {
      ...form.getFieldsValue(),
      ...patch,
    };
    form.setFieldsValue(patch);
    handleSearch(nextValues);
  };

  const showShowcase = searchResults === null;
  const showSearchEmpty =
    Array.isArray(searchResults) && searchResults.length === 0 && !loadingSearch;
  const showSearchResults =
    Array.isArray(searchResults) && searchResults.length > 0;

  return (
    <div className="discs-search-parameters">
      <Form
        form={form}
        layout="horizontal"
        onFinish={handleSearch}
        onValuesChange={handleFormChange}
        initialValues={{
          brand: [],
          supplier: undefined,
          diameter: undefined,
          pcd: undefined,
          pn: undefined,
          diskType: undefined,
          widthFrom: undefined,
          widthTo: undefined,
          cbFrom: undefined,
          cbTo: undefined,
          etFrom: undefined,
          etTo: undefined,
          onlyAmountFrom4: false,
        }}
        className="search-form"
        aria-label="Параметры поиска дисков"
      >
        <div className="search-form__toolbar">
          <div className="search-form__row">
            <div className="filter-group filter-group--disk-type">
              <Form.Item
                name="diskType"
                className="form-item-disk-type"
                getValueFromEvent={(value) => {
                  if (value === 'all' || value == null) return undefined;
                  return value;
                }}
              >
                <Select
                  {...catalogSearchSelectProps}
                  aria-label="Тип диска"
                  className="filter-select--disk-type"
                  placeholder="Тип диска"
                  options={[
                    { value: 'Литой', label: 'Литой' },
                    { value: 'Штампованный', label: 'Штампованный' },
                    { value: 'all', label: 'Все' },
                  ]}
                />
              </Form.Item>
            </div>

            <div className="filter-group filter-group--mount" role="group" aria-label="Крепление">
              <Form.Item name="diameter" className="form-item">
                <Select
                  {...catalogSearchSelectProps}
                  allowClear
                  placeholder="Диаметр"
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
              <Form.Item name="pn" className="form-item">
                <Select
                  {...catalogSearchSelectProps}
                  allowClear
                  placeholder="PN"
                  aria-label="Количество отверстий"
                  loading={loadingOptions}
                  className="filter-select--mount"
                >
                  {availablePn.map((pn) => (
                    <Option key={pn} value={pn}>
                      {pn}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="pcd" className="form-item">
                <Select
                  {...catalogSearchSelectProps}
                  allowClear
                  placeholder="PCD"
                  aria-label="PCD"
                  loading={loadingOptions}
                  className="filter-select--mount"
                >
                  {availablePcd.map((pcd) => (
                    <Option key={pcd} value={pcd}>
                      {pcd}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <div className="filter-range" role="group" aria-label="ЦО">
              <span className="filter-range__label">ЦО</span>
              <Form.Item name="cbFrom" className="form-item filter-range__item">
                <Select
                  {...catalogSearchSelectProps}
                  placeholder="от"
                  aria-label="ЦО от"
                  allowClear
                  loading={loadingOptions}
                >
                  {availableCb.map((cb) => (
                    <Option key={cb} value={cb}>
                      {cb}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="cbTo" className="form-item filter-range__item">
                <Select
                  {...catalogSearchSelectProps}
                  placeholder="до"
                  aria-label="ЦО до"
                  allowClear
                  loading={loadingOptions}
                >
                  {availableCb.map((cb) => (
                    <Option key={cb} value={cb}>
                      {cb}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <div className="filter-range" role="group" aria-label="Ширина">
              <span className="filter-range__label">Ширина</span>
              <Form.Item name="widthFrom" className="form-item filter-range__item">
                <Select
                  {...catalogSearchSelectProps}
                  placeholder="от"
                  aria-label="Ширина от"
                  allowClear
                  loading={loadingOptions}
                >
                  {availableWidths.map((width) => (
                    <Option key={width} value={width}>
                      {width}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="widthTo" className="form-item filter-range__item">
                <Select
                  {...catalogSearchSelectProps}
                  placeholder="до"
                  aria-label="Ширина до"
                  allowClear
                  loading={loadingOptions}
                >
                  {availableWidths.map((width) => (
                    <Option key={width} value={width}>
                      {width}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <div className="filter-range" role="group" aria-label="Вылет">
              <span className="filter-range__label">Вылет</span>
              <Form.Item name="etFrom" className="form-item filter-range__item">
                <Select
                  {...catalogSearchSelectProps}
                  placeholder="от"
                  aria-label="Вылет от"
                  allowClear
                  loading={loadingOptions}
                >
                  {availableEt.map((et) => (
                    <Option key={et} value={et}>
                      {et}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="etTo" className="form-item filter-range__item">
                <Select
                  {...catalogSearchSelectProps}
                  placeholder="до"
                  aria-label="Вылет до"
                  allowClear
                  loading={loadingOptions}
                >
                  {availableEt.map((et) => (
                    <Option key={et} value={et}>
                      {et}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <div className="filter-group filter-group--brand">
              <Form.Item name="brand" className="form-item form-item-brand">
                <Select
                  {...catalogSearchSelectProps}
                  {...brandSelectCloseOnMouseLeave}
                  mode="multiple"
                  placeholder="Бренд"
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
              <Form.Item name="supplier" className="form-item form-item-supplier">
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
            </div>

            <div className="filter-group filter-group--actions">
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
            </div>
          </div>
        </div>
      </Form>

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

      {showShowcase && isActive ? (
        <CatalogShowcase
          kind="discs"
          renderCard={renderCatalogCard}
          onChipClick={handleShowcaseChipClick}
        />
      ) : null}

      {showSearchEmpty ? (
        <CatalogSearchEmptyHint
          kind="discs"
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
    </div>
  );
});

export default DiscsSearchParameters;
