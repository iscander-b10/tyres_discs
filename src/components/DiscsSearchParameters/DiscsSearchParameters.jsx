import React, { useState, useEffect, useRef, memo } from 'react';
import { Form, Select, Button, Checkbox, Tooltip } from 'antd';
import { SearchOutlined, ClearOutlined } from '@ant-design/icons';
import indexedDBService from '../../services/indexedDBService';
import CatalogItemModalWindow from '../shared/CatalogItemModalWindow/CatalogItemModalWindow';
import CatalogItemCard from '../shared/CatalogItemCard/CatalogItemCard';
import PaginatedCardsList from '../shared/PaginatedCardsList/PaginatedCardsList';
import {
  catalogSearchSelectProps,
  useCatalogSelectCloseOnMouseLeave,
} from '../shared/catalogSearchSelectProps';
import './DiscsSearchParameters.scss';

const { Option } = Select;

const isActiveFilterValue = (value) =>
  value !== undefined && value !== null && value !== '';

const optionIncludesNumeric = (options, value) =>
  Array.isArray(options) && options.some((option) => Number(option) === Number(value));

const optionIncludesString = (options, value) =>
  Array.isArray(options) && options.some((option) => String(option) === String(value));

const DiscsSearchParameters = memo(({ isClientMode, catalogDataVersion = 0 }) => {
  const [form] = Form.useForm();
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [errorSearch, setErrorSearch] = useState(null);
  const [searchResults, setSearchResults] = useState(null);
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
    loadAvailableParameters(buildFiltersFromFormValues(form.getFieldsValue()));
    // Перезагрузка опций только при обновлении каталога, не при каждой смене form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogDataVersion]);

  const loadAvailableParameters = async (filters = {}) => {
    const requestId = ++loadRequestIdRef.current;

    setLoadingOptions(true);

    try {
      const options = await indexedDBService.getAvailableDiscParameterOptions(filters);

      if (requestId !== loadRequestIdRef.current) {
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

  const handleSearch = async (values) => {
    setLoadingSearch(true);
    setErrorSearch(null);
    setSearchResults(null);

    try {
      const searchParams = { ...values };

      if (searchParams.onlyAmountFrom4) {
        searchParams.minAmount = 4;
      }
      delete searchParams.onlyAmountFrom4;

      const dbResults = await indexedDBService.searchDiscs(searchParams);
      setSearchResults(dbResults);
    } catch (err) {
      setErrorSearch(err.message);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleFormChange = async (changedValues, allValues) => {
    const changedKeys = Object.keys(changedValues);
    const onlyBrandChanged = changedKeys.length === 1 && changedKeys[0] === 'brand';

    if (onlyBrandChanged) {
      return;
    }

    if (changedValues.diskType !== undefined) {
      // Keep diameter/pcd/brand/supplier/ranges — only soft-drop values
      // that do not exist for the new type at all (no full cascade wipe).
      await softInvalidateIncompatibleValues(allValues, {
        diskType: allValues.diskType,
      });
    } else {
      await softInvalidateIncompatibleValues(allValues);
    }

    if (changedValues.onlyAmountFrom4 !== undefined && searchResults !== null && !loadingSearch) {
      form.submit();
    }
  };

  const handleResetFilters = () => {
    form.resetFields();
    setSearchResults(null);
    loadAvailableParameters();
  };

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
            </div>

            <div className="filter-group filter-group--actions">
              <Tooltip title="Найти">
                <Button
                  type="primary"
                  htmlType="submit"
                  className="filter-action-btn filter-action-btn--search"
                  icon={<SearchOutlined aria-hidden />}
                  loading={loadingSearch}
                  aria-label="Найти"
                />
              </Tooltip>
              <Tooltip title="Сбросить фильтры">
                <Button
                  htmlType="button"
                  className="filter-action-btn filter-action-btn--reset"
                  icon={<ClearOutlined aria-hidden />}
                  onClick={handleResetFilters}
                  aria-label="Сбросить фильтры"
                />
              </Tooltip>
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
        emptyText="Диски не найдены. Попробуйте изменить параметры поиска."
        renderCard={(disc, { isClientMode: clientMode }) => (
          <CatalogItemCard
            key={disc.id}
            item={disc}
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

export default DiscsSearchParameters;
