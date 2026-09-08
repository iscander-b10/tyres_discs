import { PATHS } from '../app/paths';

/** Shared site contact & nav — used by SiteHeader / SiteFooter. */

/** Store phone — client / shop contact (not the developer). */
export const SITE_PHONE = {
  display: '8 800 250 88 50',
  href: 'tel:+78002508850',
};

/** Developer credit channel — site author, not store support. */
export const SITE_DEVELOPER_TELEGRAM = {
  handle: '@Iscander_b10',
  name: 'SilverTyres',
  href: 'https://t.me/Iscander_b10',
};

/** Developer contact on the marketing landing CTA (not the store phone). */
export const SITE_DEVELOPER_PHONE = {
  display: '+7 (965) 309-39-32',
  href: 'tel:+79653093932',
};

export const SITE_PRODUCT_NAV = [
  { key: 'tires', path: PATHS.tyres, label: 'Шины' },
  { key: 'disks', path: PATHS.wheels, label: 'Диски' },
  { key: 'sensors', label: 'Датчики давления', disabled: true },
];

export const SITE_SERVICE_NAV = [
  { key: 'fitting', label: 'Примерка дисков', disabled: true },
  { key: 'service', label: 'Шиномонтаж', disabled: true },
  { key: 'storage', label: 'Хранение шин', disabled: true },
];

/** Flat nav for SiteHeader (products then services). */
export const SITE_NAV_ITEMS = [...SITE_PRODUCT_NAV, ...SITE_SERVICE_NAV];
