/**
 * URL для прогрева KV-кэша (cron / GET /warm).
 * Держите в синхроне с .env.production (кроме shinservice — он идёт напрямую, но кэш не мешает).
 */
export const WARM_URLS = [
  'https://z34.ru/xml?h=50696139f497e7ed3f10c1201237058d44295f11',
  'https://z34.ru/xml/disk?h=50696139f497e7ed3f10c1201237058d44295f11',
  'https://b2b.4tochki.ru/export_data/M35753.json',
  'https://shina.su/upload/tmp/price_lists/additional_price/4/price_advanced.xlsx',
  'https://vershinatyres.ru/custom_export/export?export_format=XML&user_link=15fc4109&export_stocks%5B%5D=%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B4%D0%B0%D1%80&export_stocks%5B%5D=%D0%A1%D1%82%D0%B0%D0%B2%D1%80%D0%BE%D0%BF%D0%BE%D0%BB%D1%8C&export_category%5B%5D=tyres',
  'https://vershinatyres.ru/custom_export/export?export_format=XML&user_link=15fc4109&export_stocks%5B%5D=%D0%9A%D1%80%D0%B0%D1%81%D0%BD%D0%BE%D0%B4%D0%B0%D1%80&export_stocks%5B%5D=%D0%A1%D1%82%D0%B0%D0%B2%D1%80%D0%BE%D0%BF%D0%BE%D0%BB%D1%8C&export_category%5B%5D=rims',
];
