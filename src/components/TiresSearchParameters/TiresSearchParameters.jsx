import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Form, Select, Button, Space, Radio, Row, Col, Checkbox } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
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
    if (allValues.width) filters.width = allValues.width;
    if (allValues.profile) filters.profile = allValues.profile;
    if (allValues.diameter) filters.diameter = allValues.diameter;
    if (allValues.spikes !== undefined && allValues.spikes !== null) filters.spikes = allValues.spikes;
    return filters;
  };

  useEffect(() => {
    loadAvailableParameters(buildFiltersFromFormValues(form.getFieldsValue()));
    // Перезагрузка опций только при обновлении каталога, не при каждой смене form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogDataVersion]);

  const clearAvailableOptions = () => {
    setAvailableWidths([]);
    setAvailableProfiles([]);
    setAvailableDiameters([]);
    setAvailableBrands([]);
    setAvailableSuppliers([]);
  };

  const loadAvailableParameters = async (filters = {}) => {
    const filtersWithSeason = { season: filters.season ?? DEFAULT_SEASON, ...filters };
    const requestId = ++loadRequestIdRef.current;

    setLoadingOptions(true);
    clearAvailableOptions();

    try {
      const options = await indexedDBService.getAvailableParameterOptions(filtersWithSeason);

      if (requestId !== loadRequestIdRef.current) {
        return { brands: [], suppliers: [] };
      }

      setAvailableWidths(options.widths);
      setAvailableProfiles(options.profiles);
      setAvailableDiameters(options.diameters);
      setAvailableBrands(options.brands);
      setAvailableSuppliers(options.suppliers);

      return { brands: options.brands, suppliers: options.suppliers };
    } catch (error) {
      if (requestId === loadRequestIdRef.current) {
        clearAvailableOptions();
      }
      return { brands: [], suppliers: [] };
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoadingOptions(false);
      }
    }
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
    }

    if ('width' in changedValues) {
      const widthDependentReset = {
        profile: undefined,
        diameter: undefined,
      };
      form.setFieldsValue(widthDependentReset);
      valuesForFilters = { ...valuesForFilters, ...widthDependentReset };
    }

    if ('profile' in changedValues) {
      form.setFieldsValue({ diameter: undefined });
      valuesForFilters = { ...valuesForFilters, diameter: undefined };
    }

    await loadAvailableParameters(buildFiltersFromFormValues(valuesForFilters));

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
            <Radio value="s" className="radio-summer">Летние</Radio>
            <Radio value="w" className="radio-winter">Зимние</Radio>
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
              Найти
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