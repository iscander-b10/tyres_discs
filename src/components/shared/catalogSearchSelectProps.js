import { useCallback, useState } from 'react';
import {
  CATALOG_SELECT_DROPDOWN_CLASS,
  onCatalogSelectOpenChange,
  useCatalogSelectPopupScrollLock,
} from './catalogSelectPopupScrollLock';

export const catalogSearchSelectProps = {
  classNames: {
    popup: {
      root: CATALOG_SELECT_DROPDOWN_CLASS,
    },
  },
  onOpenChange: onCatalogSelectOpenChange,
};

/** Закрывает выпадающий список при уходе курсора с панели опций (удобно для mode="multiple"). */
export function useCatalogSelectCloseOnMouseLeave() {
  const [open, setOpen] = useState(false);
  const { onOpenChange: onLockOpenChange } = useCatalogSelectPopupScrollLock();

  const onOpenChange = useCallback((nextOpen) => {
    onLockOpenChange(nextOpen);
    setOpen(nextOpen);
  }, [onLockOpenChange]);

  const closePopup = useCallback(() => {
    onLockOpenChange(false);
    setOpen(false);
  }, [onLockOpenChange]);

  const popupRender = useCallback((menu) => (
    <div onMouseLeave={closePopup}>
      {menu}
    </div>
  ), [closePopup]);

  return { open, onOpenChange, popupRender };
}
