import { useCallback, useState } from 'react';

export const catalogSearchSelectProps = {
  classNames: {
    popup: {
      root: 'catalog-search-select-dropdown',
    },
  },
};

/** Закрывает выпадающий список при уходе курсора с панели опций (удобно для mode="multiple"). */
export function useCatalogSelectCloseOnMouseLeave() {
  const [open, setOpen] = useState(false);

  const onOpenChange = useCallback((nextOpen) => {
    setOpen(nextOpen);
  }, []);

  const popupRender = useCallback((menu) => (
    <div onMouseLeave={() => setOpen(false)}>
      {menu}
    </div>
  ), []);

  return { open, onOpenChange, popupRender };
}
