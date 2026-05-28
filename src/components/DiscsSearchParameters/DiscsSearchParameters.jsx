import React, { useState, useEffect, memo } from 'react';
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

const DiscsSearchParameters = memo(({ onDataLoaded, isClientMode }) => {
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
  const [availableDiskTypes, setAvailableDiskTypes] = useState([]);
  const brandSelectCloseOnMouseLeave = useCatalogSelectCloseOnMouseLeave();

  useEffect(() => {
    loadAvailableParameters();
  }, []);

  const loadAvailableParameters = async (filters = {}) => {
    try {
      const brands = await indexedDBService.getUniqueDiscValues('brand', filters);
      const suppliers = await indexedDBService.getUniqueDiscValues('supplier', filters);
      const diameters = await indexedDBService.getUniqueDiscValues('diameter', filters);
      const widths = await indexedDBService.getUniqueDiscValues('width', filters);
      const cb = await indexedDBService.getUniqueDiscValues('cb', filters);
      const et = await indexedDBService.getUniqueDiscValues('et', filters);
      const pcd = await indexedDBService.getUniqueDiscValues('pcd', filters);
      const pn = await indexedDBService.getUniqueDiscValues('pn', filters);
      const diskTypes = await indexedDBService.getUniqueDiscValues('diskType', filters);
      
      setAvailableBrands(brands);
      setAvailableSuppliers(suppliers);
      setAvailableDiameters(diameters);
      setAvailableWidths(widths);
      setAvailableCb(cb);
      setAvailableEt(et);
      setAvailablePcd(pcd);
      setAvailablePn(pn);
      setAvailableDiskTypes(diskTypes);
    } catch (error) {
      setAvailableBrands([]);
      setAvailableSuppliers([]);
      setAvailableDiameters([]);
      setAvailableWidths([]);
      setAvailableCb([]);
      setAvailableEt([]);
      setAvailablePcd([]);
      setAvailablePn([]);
      setAvailableDiskTypes([]);
    }
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

    const currentFilters = {};
    if (allValues.supplier) currentFilters.supplier = allValues.supplier;
    if (allValues.diameter) currentFilters.diameter = allValues.diameter;
    if (allValues.pcd) currentFilters.pcd = allValues.pcd;
    if (allValues.pn) currentFilters.pn = allValues.pn;
    if (allValues.diskType) currentFilters.diskType = allValues.diskType;
    if (allValues.widthFrom !== undefined && allValues.widthFrom !== null && allValues.widthFrom !== '') currentFilters.widthFrom = allValues.widthFrom;
    if (allValues.widthTo !== undefined && allValues.widthTo !== null && allValues.widthTo !== '') currentFilters.widthTo = allValues.widthTo;
    if (allValues.cbFrom !== undefined && allValues.cbFrom !== null && allValues.cbFrom !== '') currentFilters.cbFrom = allValues.cbFrom;
    if (allValues.cbTo !== undefined && allValues.cbTo !== null && allValues.cbTo !== '') currentFilters.cbTo = allValues.cbTo;
    if (allValues.etFrom !== undefined && allValues.etFrom !== null && allValues.etFrom !== '') currentFilters.etFrom = allValues.etFrom;
    if (allValues.etTo !== undefined && allValues.etTo !== null && allValues.etTo !== '') currentFilters.etTo = allValues.etTo;
    
    await loadAvailableParameters(currentFilters);

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
              <Select {...catalogSearchSelectProps} allowClear>
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
              <Select {...catalogSearchSelectProps} allowClear>
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
              <Select {...catalogSearchSelectProps} allowClear>
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
              <Select {...catalogSearchSelectProps} placeholder="от" allowClear>
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
              <Select {...catalogSearchSelectProps} placeholder="до" allowClear>
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
              <Select {...catalogSearchSelectProps} placeholder="от" allowClear>
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
              <Select {...catalogSearchSelectProps} placeholder="до" allowClear>
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
              <Select {...catalogSearchSelectProps} placeholder="от" allowClear>
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
              <Select {...catalogSearchSelectProps} placeholder="до" allowClear>
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
          >
            {availableBrands.map((brand) => (
              <Option key={brand} value={brand}>
                {brand}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="supplier" label="Поставщик" className="form-item">
          <Select {...catalogSearchSelectProps} placeholder="Поставщик" allowClear>
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