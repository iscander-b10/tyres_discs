import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Form, Select, Button, Space, Radio, Row, Col, Checkbox } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { ReactComponent as SunIcon } from '../../icons/Sun.svg';
import { ReactComponent as SnowIcon } from '../../icons/Snow.svg';
import indexedDBService from '../../services/indexedDBService';
import CatalogItemModalWindow from '../shared/CatalogItemModalWindow/CatalogItemModalWindow';
import CatalogItemCard from '../shared/CatalogItemCard/CatalogItemCard';
import PaginatedCardsList from '../shared/PaginatedCardsList/PaginatedCardsList';
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

      const seasonDependentReset = {
        brand: [],
        supplier: undefined,
        width: undefined,
        profile: undefined,
        diameter: undefined,
        spikes: isWinter ? (allValues.spikes === undefined ? null : allValues.spikes) : undefined,
      };
      form.setFieldsValue(seasonDependentReset);
      valuesForFilters = { ...allValues, ...seasonDependentReset, season: changedValues.season };
      await loadAvailableParameters(buildFiltersFromFormValues(valuesForFilters));
    } else {
      // Двусторонний каскад: не сбрасываем остальные size-поля; мягкая инвалидация после опций
      await softInvalidateIncompatibleSizeValues(valuesForFilters);
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
    form.resetFields();
    setSearchResults(null);
    setShowSpikesFilter(false);
    loadAvailableParameters({ season: DEFAULT_SEASON });
  };

  return (
    <div className="tires-search-parameters">
      <Form
        form={form}
        layout="vertical"
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
      >
        <Form.Item name="season" label="Сезон" className="form-item-season">
          <Radio.Group>
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

        {showSpikesFilter && (
          <Form.Item name="spikes" label="Шипы" className="form-item-spikes">
            <Radio.Group>
              <Radio value={null}>Все</Radio>
              <Radio value={true}>Шипы</Radio>
              <Radio value={false}>Без шипов</Radio>
            </Radio.Group>
          </Form.Item>
        )}

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item name="width" label="Ширина" className="form-item">
              <Select {...catalogSearchSelectProps} allowClear placeholder="Все" loading={loadingOptions}>
                {widthOptions.map((width) => (
                  <Option key={width} value={width}>
                    {width}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="profile" label="Профиль" className="form-item">
              <Select {...catalogSearchSelectProps} allowClear placeholder="Все" loading={loadingOptions}>
                {availableProfiles.map((profile) => (
                  <Option key={profile} value={profile}>
                    {profile === 0 ? '0 (груз.)' : profile}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="diameter" label="Диаметр" className="form-item">
              <Select {...catalogSearchSelectProps} allowClear placeholder="Все" loading={loadingOptions}>
                {availableDiameters.map((diameter) => (
                  <Option key={diameter} value={diameter}>
                    {diameter}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="brand" label="Бренд" className="form-item form-item-brand">
          <Select
            {...catalogSearchSelectProps}
            {...brandSelectCloseOnMouseLeave}
            mode="multiple"
            placeholder="Бренд"
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

        <Form.Item name="supplier" label="Поставщик" className="form-item">
          <Select {...catalogSearchSelectProps} placeholder="Поставщик" allowClear loading={loadingOptions}>
            {availableSuppliers.map((supplier) => (
              <Option key={supplier} value={supplier}>
                {supplier}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="onlyAmountFrom4" valuePropName="checked" className="form-item">
          <Checkbox>Наличие от 4 шт.</Checkbox>
        </Form.Item>

        <Form.Item name="onlyRunflat" valuePropName="checked" className="form-item">
          <Checkbox>Runflat</Checkbox>
        </Form.Item>

        <Form.Item className="form-actions">
          <Space>
            <Button type="primary" icon={<SearchOutlined />} loading={loadingSearch} htmlType="submit">
              Подобрать
            </Button>
            <Button onClick={handleResetFilters}>Сбросить</Button>
          </Space>
        </Form.Item>
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