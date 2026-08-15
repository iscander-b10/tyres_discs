/**
 * ShowcaseConfig — единая точка для размеров/лимитов витрины.
 * Позже список размеров и топы можно подменить с API без переписывания UI.
 */

/** @typedef {{ label: string, width: number, profile: number, diameter: string }} TireSizeChip */
/** @typedef {{ label: string, diameter: string, pn: number, pcd: number, cb: number, cbFrom?: number, cbTo?: number }} DiscSizeChip */

export const SHOWCASE_CONFIG = {
  /**
   * Полки карточек («Сейчас в сезоне» / «Литые диски в наличии») только из этого поставщика.
   * Совпадает с `item.supplier` в IDB (label Шинсервиса).
   */
  showcaseSupplier: 'Шинсервис',
  tires: {
    /** @type {TireSizeChip[]} */
    popularSizes: [
      { label: '175/70 R13', width: 175, profile: 70, diameter: 'R13' },
      { label: '175/65 R14', width: 175, profile: 65, diameter: 'R14' },
      { label: '185/60 R14', width: 185, profile: 60, diameter: 'R14' },
      { label: '185/65 R15', width: 185, profile: 65, diameter: 'R15' },
      { label: '195/65 R15', width: 195, profile: 65, diameter: 'R15' },
      { label: '185/75 R16C', width: 185, profile: 75, diameter: 'R16C' },
      { label: '205/55 R16', width: 205, profile: 55, diameter: 'R16' },
      { label: '215/65 R16', width: 215, profile: 65, diameter: 'R16' },
      { label: '205/55 R17', width: 205, profile: 55, diameter: 'R17' },
      { label: '215/55 R17', width: 215, profile: 55, diameter: 'R17' },
      { label: '225/65 R17', width: 225, profile: 65, diameter: 'R17' },
      { label: '235/45 R18', width: 235, profile: 45, diameter: 'R18' },
      { label: '225/60 R18', width: 225, profile: 60, diameter: 'R18' },
      { label: '225/55 R19', width: 225, profile: 55, diameter: 'R19' },
      { label: '235/55 R19', width: 235, profile: 55, diameter: 'R19' },
    ],
    seasonHitsCount: { min: 8, max: 12 },
    /** Кандидаты из IDB (ранний лимит, не весь каталог). */
    candidateLimit: 480,
    minAmount: 1,
  },
  discs: {
    /** @type {DiscSizeChip[]} */
    popularSizes: [
      { label: 'R14 PCD 4x98 ЦО 58.6', diameter: 'R14', pn: 4, pcd: 98, cb: 58.6 },
      { label: 'R15 PCD 4x100 ЦО 54.1', diameter: 'R15', pn: 4, pcd: 100, cb: 54.1 },
      { label: 'R15 PCD 4x100 ЦО 60.1', diameter: 'R15', pn: 4, pcd: 100, cb: 60.1 },
      { label: 'R15 PCD 5x100 ЦО 57.1', diameter: 'R15', pn: 5, pcd: 100, cb: 57.1 },
      { label: 'R16 PCD 4x100 ЦО 60.1', diameter: 'R16', pn: 4, pcd: 100, cb: 60.1 },
      { label: 'R16 PCD 5x114.3 ЦО 60.1', diameter: 'R16', pn: 5, pcd: 114.3, cb: 60.1 },
      { label: 'R16 PCD 5x112 ЦО 57.1', diameter: 'R16', pn: 5, pcd: 112, cb: 57.1 },
      { label: 'R16 PCD 5x139.7 ЦО 98', diameter: 'R16', pn: 5, pcd: 139.7, cb: 98, cbFrom: 98, cbTo: 98.6 },
      { label: 'R17 PCD 5x114.3 ЦО 67.1', diameter: 'R17', pn: 5, pcd: 114.3, cb: 67.1 },
      { label: 'R17 PCD 5x105 ЦО 60.1', diameter: 'R17', pn: 5, pcd: 105, cb: 60.1 },
      { label: 'R17 PCD 5x112 ЦО 57.1', diameter: 'R17', pn: 5, pcd: 112, cb: 57.1 },
      { label: 'R18 PCD 5x114.3 ЦО 67.1', diameter: 'R18', pn: 5, pcd: 114.3, cb: 67.1 },
    ],
    popularModelsCount: { min: 8, max: 12 },
    /** Кандидаты из IDB (ранний лимит, не весь каталог). */
    candidateLimit: 480,
    minAmount: 1,
  },
  copy: {
    seasonHits: 'Сейчас в сезоне',
    popularModels: 'Литые диски в наличии',
    popularSizes: 'Частые размеры',
    catalogEmptyTitle: 'Каталог не загружен',
    catalogEmptyHint: 'Загрузите поставщиков в боковой панели.',
    trySizes: 'Другие размеры',
  },
};

/** Лето: мар–авг (месяцы 2–7); зима: сен–фев. */
export const getCatalogSeasonFromDate = (date = new Date()) => {
  const month = date.getMonth();
  return month >= 2 && month <= 7 ? 's' : 'w';
};
