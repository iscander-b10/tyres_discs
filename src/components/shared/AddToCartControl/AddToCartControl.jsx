import React, { useRef } from 'react';
import { Button } from 'antd';
import { ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '../../../app/paths';
import { useAuth } from '../../../auth/AuthContext';
import { useCart } from '../../../cart/CartContext';
import indexedDBService from '../../../services/indexedDBService';
import {
  getCartItemKey,
  isCatalogItemSellable,
  parseStock,
} from '../../../cart/cartUtils';
import CartQtyControls from '../CartQtyControls/CartQtyControls';
import './AddToCartControl.scss';

function AddToCartControl({
  item,
  category,
  onGoToCart,
  className = '',
  block = true,
}) {
  const navigate = useNavigate();
  const { isWorkspaceReady, workspace } = useAuth();
  const {
    addItem,
    getItem,
    increment,
    decrement,
    removeItem,
    isLoaded,
  } = useCart();
  const workspaceKey = isWorkspaceReady && workspace
    ? `${workspace.accountId}:${workspace.storeId}`
    : '';
  const workspaceKeyRef = useRef(workspaceKey);
  workspaceKeyRef.current = workspaceKey;
  const key = getCartItemKey(item, category);
  const cartLine = getItem(key);
  const canAdd =
    Boolean(workspaceKey) &&
    isLoaded &&
    isCatalogItemSellable(item, category);

  const handleAdd = async (event) => {
    event.stopPropagation();
    if (!key || !canAdd) return;
    const requestedWorkspaceKey = workspaceKey;
    const requestedStoreId = workspace.storeId;

    try {
      const catalogRead = await indexedDBService.readCartCatalogItems([
        { requestKey: key, category, id: String(item.id) },
      ]);
      if (
        requestedWorkspaceKey !== workspaceKeyRef.current ||
        !indexedDBService.isActiveStore(requestedStoreId)
      ) {
        return;
      }
      const currentItem = catalogRead.results[0]?.matches?.[category];
      if (currentItem) addItem(currentItem, category);
    } catch {
      // A failed read must not add a stale snapshot.
    }
  };

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
        onClick={handleAdd}
        aria-label={canAdd ? 'Добавить в корзину' : 'Нет в наличии'}
      >
        В корзину
      </Button>
    </div>
  );
}

export default AddToCartControl;
