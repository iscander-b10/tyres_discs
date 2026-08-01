import React, { useState, useEffect, useRef, memo } from 'react';
import { Form, Select, Button, Space, Row, Col, Radio, Checkbox, Flex } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
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

  const softInvalidateIncompatibleValues = async (values) => {
    let currentValues = { ...values };
    let options = await loadAvailableParameters(buildFiltersFromFormValues(currentValues));
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

    await softInvalidateIncompatibleValues(allValues);

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
    <Flex className="discs-search-parameters" align="start" gap={30}>
      <Form
        form={form}
        layout="vertical"
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
      >
        <Form.Item name="diskType" className="form-item-disk-type">
          <Radio.Group>
            <Radio value="Литой">Литой</Radio>
            <Radio value="Штампованный">Штампованный</Radio>
          </Radio.Group>
        </Form.Item>

        <Row gutter={16}>
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
          <Col xs={24} sm={8}>
            <Form.Item name="pn" label="PN" className="form-item">
              <Select {...catalogSearchSelectProps} allowClear placeholder="Все" loading={loadingOptions}>
                {availablePn.map((pn) => (
                  <Option key={pn} value={pn}>
                    {pn}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="pcd" label="PCD" className="form-item">
              <Select {...catalogSearchSelectProps} allowClear placeholder="Все" loading={loadingOptions}>
                {availablePcd.map((pcd) => (
                  <Option key={pcd} value={pcd}>
                    {pcd}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="widthFrom" label="Ширина" className="form-item">
              <Select {...catalogSearchSelectProps} placeholder="от" allowClear loading={loadingOptions}>
                {availableWidths.map((width) => (
                  <Option key={width} value={width}>
                    {width}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="widthTo" label=" " className="form-item form-item-label-hidden">
              <Select {...catalogSearchSelectProps} placeholder="до" allowClear loading={loadingOptions}>
                {availableWidths.map((width) => (
                  <Option key={width} value={width}>
                    {width}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="cbFrom" label="CB" className="form-item">
              <Select {...catalogSearchSelectProps} placeholder="от" allowClear loading={loadingOptions}>
                {availableCb.map((cb) => (
                  <Option key={cb} value={cb}>
                    {cb}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="cbTo" label=" " className="form-item form-item-label-hidden">
              <Select {...catalogSearchSelectProps} placeholder="до" allowClear loading={loadingOptions}>
                {availableCb.map((cb) => (
                  <Option key={cb} value={cb}>
                    {cb}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item name="etFrom" label="ET" className="form-item">
              <Select {...catalogSearchSelectProps} placeholder="от" allowClear loading={loadingOptions}>
                {availableEt.map((et) => (
                  <Option key={et} value={et}>
                    {et}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="etTo" label=" " className="form-item form-item-label-hidden">
              <Select {...catalogSearchSelectProps} placeholder="до" allowClear loading={loadingOptions}>
                {availableEt.map((et) => (
                  <Option key={et} value={et}>
                    {et}
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

        <Form.Item className="form-actions">
          <Space>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={loadingSearch}
              htmlType="submit"
            >
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
    </Flex>
  );
});

export default DiscsSearchParameters;