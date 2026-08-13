/** Shared site contact & nav — used by SiteHeader / SiteFooter. */

/** Store phone — client / shop contact (not the developer). */
export const SITE_PHONE = {
  display: '8 800 250 88 50',
  href: 'tel:+78002508850',
};

/** Developer credit channel — site author, not store support. */
export const SITE_DEVELOPER_TELEGRAM = {
  handle: '@Iscander_b10',
  href: 'https://t.me/Iscander_b10',
};

export const SITE_PRODUCT_NAV = [
  { key: 'tires', label: 'Шины' },
  { key: 'disks', label: 'Диски' },
  { key: 'sensors', label: 'Датчики давления', disabled: true },
];

export const SITE_SERVICE_NAV = [
  { key: 'fitting', label: 'Примерка дисков', disabled: true },
  { key: 'service', label: 'Шиномонтаж', disabled: true },
  { key: 'storage', label: 'Хранение шин', disabled: true },
];

/** Flat nav for SiteHeader (products then services). */
export const SITE_NAV_ITEMS = [...SITE_PRODUCT_NAV, ...SITE_SERVICE_NAV];
