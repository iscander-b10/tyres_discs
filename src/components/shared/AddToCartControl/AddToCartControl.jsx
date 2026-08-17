import React from 'react';
import { Button } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '../../../app/paths';
import { useCart } from '../../../cart/CartContext';
import { getCartItemKey, getDefaultCartQty, parseStock } from '../../../cart/cartUtils';
import CartQtyControls from '../CartQtyControls/CartQtyControls';
import './AddToCartControl.scss';

function AddToCartControl({ item, onGoToCart, className = '', block = true }) {
  const navigate = useNavigate();
  const { addItem, getItem, increment, decrement, removeItem } = useCart();
  const key = getCartItemKey(item);
  const cartLine = getItem(key);
  const stock = parseStock(item?.amount);
  const canAdd = stock > 0 && getDefaultCartQty(item?.amount) > 0;

  const handleGoToCart = (e) => {
    e.stopPropagation();
    onGoToCart?.();
    navigate(PATHS.basket);
  };

  const rootClassName = [
    'add-to-cart',
    cartLine ? 'add-to-cart--in-cart' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (cartLine) {
    const maxStock = parseStock(cartLine.maxStock ?? cartLine.amount ?? item?.amount);
    return (
      <div className={rootClassName}>
        <CartQtyControls
          quantity={cartLine.quantity}
          maxStock={maxStock}
          onDecrement={() => {
            if (cartLine.quantity <= 1) {
              removeItem(key);
              return;
            }
            decrement(key);
          }}
          onIncrement={() => increment(key)}
          size="small"
          allowRemoveAtMin
        />
        <Button
          className="add-to-cart__go"
          type="default"
          onClick={handleGoToCart}
          block={block}
        >
          Перейти в корзину
        </Button>
      </div>
    );
  }

  return (
    <div className={rootClassName}>
      <Button
        className="add-to-cart__add"
        type="primary"
        icon={<ShoppingCartOutlined aria-hidden />}
        disabled={!canAdd}
        block={block}
        onClick={(e) => {
          e.stopPropagation();
          addItem(item);
        }}
        aria-label={canAdd ? 'Добавить в корзину' : 'Нет в наличии'}
      >
        В корзину
      </Button>
    </div>
  );
}

export default AddToCartControl;
