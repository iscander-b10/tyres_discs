/**
 * ShowcaseConfig — единая точка для размеров/лимитов витрины.
 * Позже список размеров и топы можно подменить с API без переписывания UI.
 */

/** @typedef {{ label: string, width: number, profile: number, diameter: string }} TireSizeChip */
/** @typedef {{ label: string, diameter: string }} DiscDiameterChip */

export const SHOWCASE_CONFIG = {
  /**
   * Полки карточек («Хиты сезона» / «Популярные модели») только из этого поставщика.
   * Совпадает с `item.supplier` в IDB (label Шинсервиса).
   */
  showcaseSupplier: 'Шинсервис',
  tires: {
    /** @type {TireSizeChip[]} */
    popularSizes: [
      { label: '205/55 R16', width: 205, profile: 55, diameter: 'R16' },
      { label: '225/45 R17', width: 225, profile: 45, diameter: 'R17' },
      { label: '215/55 R17', width: 215, profile: 55, diameter: 'R17' },
      { label: '195/65 R15', width: 195, profile: 65, diameter: 'R15' },
      { label: '225/55 R17', width: 225, profile: 55, diameter: 'R17' },
      { label: '185/65 R15', width: 185, profile: 65, diameter: 'R15' },
      { label: '235/45 R18', width: 235, profile: 45, diameter: 'R18' },
      { label: '215/60 R16', width: 215, profile: 60, diameter: 'R16' },
    ],
    seasonHitsCount: { min: 8, max: 12 },
    /** Кандидаты из IDB (ранний лимит, не весь каталог). */
    candidateLimit: 480,
    minAmount: 1,
  },
  discs: {
    /** @type {DiscDiameterChip[]} */
    popularDiameters: [
      { label: 'R15', diameter: 'R15' },
      { label: 'R16', diameter: 'R16' },
      { label: 'R17', diameter: 'R17' },
      { label: 'R18', diameter: 'R18' },
      { label: 'R19', diameter: 'R19' },
      { label: 'R20', diameter: 'R20' },
    ],
    popularModelsCount: { min: 8, max: 12 },
    /** Кандидаты из IDB (ранний лимит, не весь каталог). */
    candidateLimit: 480,
    minAmount: 1,
  },
  copy: {
    seasonHits: 'Хиты сезона',
    popularModels: 'Популярные модели',
    popularSizes: 'Популярные размеры',
    popularDiameters: 'Популярные диаметры',
    catalogEmptyTitle: 'Каталог ещё не загружен',
    catalogEmptyHint: 'Загрузите данные поставщиков в боковой панели — после этого здесь появятся подборки.',
    trySizes: 'Попробуйте популярные размеры',
    tryDiameters: 'Попробуйте популярные диаметры',
  },
};

/** Лето: мар–авг (месяцы 2–7); зима: сен–фев. */
export const getCatalogSeasonFromDate = (date = new Date()) => {
  const month = date.getMonth();
  return month >= 2 && month <= 7 ? 's' : 'w';
};
