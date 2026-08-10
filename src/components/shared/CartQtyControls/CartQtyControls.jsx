import React from 'react';
import { Button } from 'antd';
import { MinusOutlined, PlusOutlined } from '@ant-design/icons';
import './CartQtyControls.scss';

function CartQtyControls({
  quantity,
  maxStock,
  onDecrement,
  onIncrement,
  size = 'middle',
  className = '',
  disabled = false,
}) {
  const max = Number(maxStock);
  const atMin = quantity <= 1;
  const atMax = Number.isFinite(max) && max > 0 && quantity >= max;

  return (
    <div
      className={['cart-qty', size === 'small' ? 'cart-qty--small' : '', className]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label="Количество"
    >
      <Button
        className="cart-qty__btn"
        type="text"
        icon={<MinusOutlined aria-hidden />}
        onClick={(e) => {
          e.stopPropagation();
          onDecrement?.(e);
        }}
        disabled={disabled || atMin}
        aria-label="Уменьшить количество"
      />
      <span className="cart-qty__value" aria-live="polite">
        {quantity}
      </span>
      <Button
        className="cart-qty__btn"
        type="text"
        icon={<PlusOutlined aria-hidden />}
        onClick={(e) => {
          e.stopPropagation();
          onIncrement?.(e);
        }}
        disabled={disabled || atMax}
        aria-label="Увеличить количество"
      />
    </div>
  );
}

export default CartQtyControls;
