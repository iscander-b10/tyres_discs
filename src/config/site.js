import { PATHS } from '../app/paths';

/** Shared product chrome on guest landing `/`, not a tenant store profile. */

/** Product brand mark on landing. Demo and staff catalog use store profile displayName. */
export const SITE_BRAND = 'SilverTyres';

/** Product contact on landing header/footer and CTA (not a store phone). */
export const SITE_PHONE = {
  display: '8 965 309-39-32',
  /** CTA slide matches presentation/ deck copy. */
  ctaDisplay: '+7 (965) 309-39-32',
  href: 'tel:+79653093932',
};

/** Product Telegram on landing CTA (same handle as presentation/). */
export const SITE_TELEGRAM = {
  href: 'https://t.me/AlexandrKorobeinikoff',
  display: 'AlexandrKorobeinikoff',
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
