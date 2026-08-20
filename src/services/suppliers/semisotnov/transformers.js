import { calculateSellingPrice, getMargin } from '../../dataTransformers';
import { deriveModelFromTitle, normalizeModelText } from '../shared/deriveModel';

const normalizeBrand = (brand) => (
  String(brand).trim() === 'BELSHINA' ? 'Belshina' :
  String(brand).trim() === 'LingLong' ? 'LingLong Leao' :
  String(brand).trim() === 'ATLANDER' ? 'Atlander' :
  String(brand).trim() === 'ROADMARCH' ? 'Roadmarch' :
  String(brand).trim() === 'ROADCRUZA' ? 'Roadcruza' :
  String(brand).trim() === 'BARS' ? 'Bars' :
  String(brand).trim() === 'Кама Евро' ? 'Кама' :
  String(brand).trim() === 'NORTEC' ? 'NorTec' :
  String(brand).trim() === 'Pirelli Formula' ? 'Formula' :
  String(brand).trim() === 'PowerTrac' ? 'Powertrac' :
  String(brand).trim() === 'WestLake' ? 'Westlake' :
  String(brand).trim() === 'Алтай' ? 'Алтайшина' :
  String(brand).trim() === 'GoodRide' ? 'Goodride' :
  String(brand).trim() === 'HIFLY' ? 'Hifly' :
  String(brand).trim() === 'TRACMAX' ? 'Tracmax' :
  String(brand).trim() === 'BLACKARROW' ? 'Blackrrow' :
  String(brand).trim() === 'ROYAL BLACK' ? 'Royal Black' :
  String(brand).trim() === 'YAZD' ? 'Yazd' :
  brand
);
const parseTyreSize = (sizeStr) => {
  const pattern = /^(?<width>\d+)(?:\/(?<profile>\d+))?(?<diameter>R\d+(?:C)?)$/;
  const match = sizeStr.match(pattern);

  if (!match) {
    return { width: 0, profile: 0, diameter: '' };
  }

  const { width, profile, diameter } = match.groups;

  return {
    width: parseInt(width, 10),
    profile: profile ? parseInt(profile, 10) : 0,
    diameter: diameter
  };
};

const parseTitle = (str) => {
  // В Наименовании суффикс cargo бывает латиницей (C) или кириллицей (С)
  const sizePattern = /\d+(?:\/\d+)?R\d+(?:[CcСс])?/;
  const match = str.match(sizePattern);
  let result;
  if (match) {
    result = str.slice(0, match.index) + str.slice(match.index + match[0].length);
  } else {
    result = str;
  }

  result = result.replace(/\s*(?:шип\.|нешипуемая)\s*/gi, ' ');
  result = result.trim().replace(/\s+/g, ' ');

  // Cargo: поставщик пишет отдельный маркер "c"/"с" в начале Наименования;
  // признак уже есть в diameter (R16C) — из title убираем только standalone-токен.
  result = result.replace(/^[CcСс](?=\s|$)\s*/, '').trim();

  return result;
};

const parseSeason = (season) => season.includes('Да') ? 's' : 'w';

const parseSpikes = (spikes) => spikes.includes('шипованная') ? true : false;

export const transformTyres = (rawData) => {
  const tyresArray = rawData.Выгрузка_Шины.Шина;
  if (!tyresArray || !Array.isArray(tyresArray)) {
      throw new Error('Неверная структура данных шин от Семисотнова');
  }

  return tyresArray.map((tyre) => {
    const sizeData = parseTyreSize(tyre.Типоразмер);
    const { width, profile, diameter } = sizeData;
    const normalizedBrand = normalizeBrand(tyre.Бренд);
    const title = parseTitle(tyre.Наименование);
    const model = deriveModelFromTitle(title, normalizedBrand, { stripIndices: true });
    const margin = getMargin(normalizedBrand);
    const sellingPrice = calculateSellingPrice(tyre.Цена, margin);
    return {
        id: `semisotnov_${tyre.Код}`,
        code: tyre.Код,
        brand: normalizedBrand,
        model,
        width,
        profile,
        diameter,
        season: parseSeason(tyre.Лето),
        spikes: parseSpikes(tyre.Шипы),
        amount: tyre.Остаток,
        title,
        sizeTitle: tyre.Типоразмер,
        price: tyre.Цена,
        sellingPrice,
        photoUrl: tyre.Фото,
        supplier: 'Семисотнов'
    }
  })
}

const parseDiscDiameter = (diameter) => `R${diameter}`;
const STAMPED_DISC_BRANDS = new Set(['Better', 'R-STEEL', 'TREBL', 'ТЗСК', 'КрКЗ', 'Asterro', 'Mefro', 'ACCURIDE', 'Тайвань &amp; Китай', 'Нижний Новгород', 'KRONPRINZ', 'ARRIVO', 'SRW', 'Gold Wheel', 'LAND STAR', 'Jantsa', 'LEMMERZ']);
const parseDiskTypeByBrand = (brand) => (
  STAMPED_DISC_BRANDS.has(String(brand).trim()) ? 'Штампованный' : 'Литой'
);

const normalizeDiscBrand = (rawBrand) => {
  const brand = String(rawBrand ?? '').trim();
  const key = brand.toLowerCase();

  const brandMap = {
    'carwel': 'Carwel',
    'd&amp;p': 'D&P',
    'k&amp;k': 'K&K',
    'kronprinz': 'Kronprinz',
    'mefro': 'MEFRO (Аккурайд/KRONPRINZ)',
    'lemmerz': 'Lemmerz',
    'скад': 'SCAD',
    'yamoto segun': 'Yamato Segun',
  };

  return brandMap[key] || brand;   
};

export const transformDiscs = (rawData) => {
  const discsArray = rawData.Выгрузка_Диски.Диск;
  if (!discsArray || !Array.isArray(discsArray)) {
    throw new Error('Неверная структура данных дисков от Семисотнова');
  }

  return discsArray.map((disc) => {
    const brand = normalizeDiscBrand(disc.Бренд);
    const model = normalizeModelText(disc.Модель);
    const title = `${brand} ${model ?? ''}`.replace(/\s+/g, ' ').trim();
    const sizeTitle = `${parseDiscDiameter(disc.Диаметр)} / ${disc.Ширина}J PCD ${disc.Болт_количество}x${disc.PCD} ET ${disc.ET} ЦО ${disc.DIA}`;
    const diskType = parseDiskTypeByBrand(disc.Бренд);

    return {
      id: `semisotnov_${disc.Код}`,
      code: disc.Код,
      brand,
      model,
      diameter: parseDiscDiameter(disc.Диаметр),
      width: disc.Ширина,
      pn: disc.Болт_количество,
      pcd: disc.PCD,
      et: disc.ET,
      cb: disc.DIA,
      diskType,
      color: disc.Цвет,
      amount: disc.Остаток,
      title,
      sizeTitle,
      price: disc.Цена,
      sellingPrice: Math.round(disc.Цена * 1.2),
      photoUrl: disc.Фото,
      supplier: 'Семисотнов',
    }
  })
};