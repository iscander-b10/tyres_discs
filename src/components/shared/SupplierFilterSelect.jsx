import React, { memo } from 'react';
import { Select } from 'antd';
import HoverTooltip from './HoverTooltip';
import { catalogSearchSelectProps } from './catalogSearchSelectProps';

const { Option } = Select;

/**
 * Supplier Select for catalog filters.
 * In client mode hides the supplier name in the closed selector (blur)
 * while Form value stays real; name is available via HoverTooltip.
 */
const SupplierFilterSelect = memo(function SupplierFilterSelect({
  isClientMode = false,
  loading = false,
  options = [],
  value,
  onChange,
  ...rest
}) {
  const hasValue = value !== undefined && value !== null && value !== '';
  const tooltipTitle = hasValue ? `Поставщик: ${value}` : 'Поставщик';
  const ariaLabel = isClientMode && hasValue ? tooltipTitle : 'Поставщик';

  const select = (
    <Select
      {...catalogSearchSelectProps}
      {...rest}
      value={value}
      onChange={onChange}
      placeholder="Поставщик"
      aria-label={ariaLabel}
      allowClear
      loading={loading}
      className={[
        'filter-select--supplier',
        isClientMode ? 'filter-select--supplier-client' : null,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {options.map((supplier) => (
        <Option key={supplier} value={supplier}>
          {supplier}
        </Option>
      ))}
    </Select>
  );

  if (!isClientMode) {
    return select;
  }

  return (
    <HoverTooltip title={tooltipTitle} placement="top">
      <div className="supplier-select-client-target">
        {select}
      </div>
    </HoverTooltip>
  );
});

export default SupplierFilterSelect;
