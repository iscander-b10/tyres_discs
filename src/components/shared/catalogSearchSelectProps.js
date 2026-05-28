import { useCallback, useState } from 'react';

export const catalogSearchSelectProps = {
  popupClassName: 'catalog-search-select-dropdown',
};

/** Закрывает выпадающий список при уходе курсора с панели опций (удобно для mode="multiple"). */
export function useCatalogSelectCloseOnMouseLeave() {
  const [open, setOpen] = useState(false);

  const onOpenChange = useCallback((nextOpen) => {
    setOpen(nextOpen);
  }, []);

  const dropdownRender = useCallback((menu) => (
    <div onMouseLeave={() => setOpen(false)}>
      {menu}
    </div>
  ), []);

  return { open, onOpenChange, dropdownRender };
}
