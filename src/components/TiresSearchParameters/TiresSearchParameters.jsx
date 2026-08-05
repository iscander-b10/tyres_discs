import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Form, Select, Button, Radio, Checkbox } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { ReactComponent as SunIcon } from '../../icons/Sun.svg';
import { ReactComponent as SnowIcon } from '../../icons/Snow.svg';
import { ReactComponent as ResetIcon } from '../../icons/Reset.svg';
import indexedDBService from '../../services/indexedDBService';
import CatalogItemModalWindow from '../shared/CatalogItemModalWindow/CatalogItemModalWindow';
import CatalogItemCard from '../shared/CatalogItemCard/CatalogItemCard';
import PaginatedCardsList from '../shared/PaginatedCardsList/PaginatedCardsList';
import HoverTooltip from '../shared/HoverTooltip';
import {
  catalogSearchSelectProps,
  useCatalogSelectCloseOnMouseLeave,
} from '../shared/catalogSearchSelectProps';
import './TiresSearchParameters.scss';

const { Option } = Select;

const DEFAULT_SEASON = 's';

const isActiveFilterValue = (value) =>
  value !== undefined && value !== null && value !== '';

const optionIncludesNumeric = (options, value) =>
  Array.isArray(options) && options.some((option) => Number(option) === Number(value));

const optionIncludesDiameter = (options, value) =>
  Array.isArray(options) && options.some((option) => String(option) === String(value));

const TiresSearchParameters = memo(({ isClientMode, catalogDataVersion = 0 }) => {
  const [form] = Form.useForm();
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [errorSearch, setErrorSearch] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
  const [availableWidths, setAvailableWidths] = useState([]);
  const [availableProfiles, setAvailableProfiles] = useState([]);
  const [availableDiameters, setAvailableDiameters] = useState([]);
  const [availableBrands, setAvailableBrands] = useState([]);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [showSpikesFilter, setShowSpikesFilter] = useState(false);
  const loadRequestIdRef = useRef(0);
  const brandSelectCloseOnMouseLeave = useCatalogSelectCloseOnMouseLeave();
  const selectedSeason = Form.useWatch('season', form) ?? DEFAULT_SEASON;

  const widthOptions = useMemo(() => {
    if (!Array.isArray(availableWidths)) return [];

    // In summer mode start dropdown from 135 for faster common-size access.
    if (selectedSeason !== 's') return availableWidths;

    const sortedWidths = [...availableWidths].sort((a, b) => Number(a) - Number(b));
    const splitIndex = sortedWidths.findIndex((width) => Number(width) >= 135);
    if (splitIndex === -1) return sortedWidths;

    return [...sortedWidths.slice(splitIndex), ...sortedWidths.slice(0, splitIndex)];
  }, [availableWidths, selectedSeason]);

  const buildFiltersFromFormValues = (allValues = {}) => {
    const filters = { season: allValues.season ?? DEFAULT_SEASON };
    if (isActiveFilterValue(allValues.width)) filters.width = allValues.width;
    if (isActiveFilterValue(allValues.profile)) filters.profile = allValues.profile;
    if (isActiveFilterValue(allValues.diameter)) filters.diameter = allValues.diameter;
    if (allValues.spikes !== undefined && allValues.spikes !== null) filters.spikes = allValues.spikes;
    return filters;
  };

  useEffect(() => {
    loadAvailableParameters(buildFiltersFromFormValues(form.getFieldsValue()));
    // Перезагрузка опций только при обновлении каталога, не при каждой смене form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogDataVersion]);

  const loadAvailableParameters = async (filters = {}) => {
    const filtersWithSeason = { season: filters.season ?? DEFAULT_SEASON, ...filters };
    const requestId = ++loadRequestIdRef.current;

    setLoadingOptions(true);

    try {
      const options = await indexedDBService.getAvailableParameterOptions(filtersWithSeason);

      if (requestId !== loadRequestIdRef.current) {
        return null;
      }

      setAvailableWidths(options.widths);
      setAvailableProfiles(options.profiles);
      setAvailableDiameters(options.diameters);
      setAvailableBrands(options.brands);
      setAvailableSuppliers(options.suppliers);

      return options;
    } catch (error) {
      // Оставляем предыдущие опции, чтобы UI не моргал пустыми списками
      return null;
    } finally {
      if (requestId === loadRequestIdRef.current) {
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

  const handleSearch = async (values) => {
    setLoadingSearch(true);
    setErrorSearch(null);
    setSearchResults(null);

    try {
      const searchParams = { ...values };
      if (searchParams.spikes === null) {
        delete searchParams.spikes;
      }
      if (searchParams.onlyAmountFrom4) {
        searchParams.minAmount = 4;
      }
      delete searchParams.onlyAmountFrom4;
      if (searchParams.onlyRunflat) {
        searchParams.runflat = true;
      }
      delete searchParams.onlyRunflat;
      const dbResults = await indexedDBService.searchTires(searchParams);
      setSearchResults(dbResults);
    } catch (err) {
      setErrorSearch(err.message);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleFormChange = async (changedValues, allValues) => {
    let valuesForFilters = allValues;

    if (changedValues.season !== undefined) {
      const isWinter = changedValues.season === 'w';
      setShowSpikesFilter(isWinter);

      // Keep size/brand/supplier/etc. — only sync spikes for winter UI.
      const spikesUpdate = {
        spikes: isWinter
          ? (allValues.spikes === undefined ? null : allValues.spikes)
          : undefined,
      };
      form.setFieldsValue(spikesUpdate);
      valuesForFilters = { ...allValues, ...spikesUpdate, season: changedValues.season };
    }

    // Soft-drop only values missing from the new option lists (incl. after season change).
    await softInvalidateIncompatibleSizeValues(valuesForFilters);

    if (
      (changedValues.onlyAmountFrom4 !== undefined || changedValues.onlyRunflat !== undefined) &&
      searchResults !== null &&
      !loadingSearch
    ) {
      form.submit();
    }
  };

  const handleResetFilters = () => {
    form.resetFields();
    setSearchResults(null);
    setShowSpikesFilter(false);
    loadAvailableParameters({ season: DEFAULT_SEASON });
  };

  return (
    <div className="tires-search-parameters">
      <Form
        form={form}
        layout="horizontal"
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
              <Form.Item name="width" className="form-item">
                <Select
                  {...catalogSearchSelectProps}
                  allowClear
                  placeholder="Ширина"
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
              <Form.Item name="profile" className="form-item">
                <Select
                  {...catalogSearchSelectProps}
                  allowClear
                  placeholder="Профиль"
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
                <Select
                  {...catalogSearchSelectProps}
                  placeholder="Поставщик"
                  aria-label="Поставщик"
                  allowClear
                  loading={loadingOptions}
                >
                  {availableSuppliers.map((supplier) => (
                    <Option key={supplier} value={supplier}>
                      {supplier}
                    </Option>
                  ))}
                </Select>
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
              <HoverTooltip title="Найти">
                <Button
                  type="primary"
                  htmlType="submit"
                  className="filter-action-btn filter-action-btn--search"
                  icon={<SearchOutlined aria-hidden />}
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

      <PaginatedCardsList
        items={searchResults}
        error={errorSearch}
        isClientMode={isClientMode}
        containerClassName="items-list-container"
        gridClassName="items-grid"
        emptyText="Шины не найдены. Попробуйте изменить параметры поиска."
        renderCard={(tire, { isClientMode: clientMode }) => (
          <CatalogItemCard
            key={tire.id}
            item={tire}
            isClientMode={clientMode}
            cardClassName="item-card"
            ModalComponent={CatalogItemModalWindow}
            modalItemPropName="item"
          />
        )}
      />
    </div>
  );
});

export default TiresSearchParameters;
