import { calculateSellingPrice, getMargin } from '../../dataTransformers';
import {
  extractLoadSpeedFromTitle,
  normalizeModelText,
} from '../shared/deriveModel';

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
  String(brand).trim() === 'BLACKARROW' ? 'Blackarrow' :
  String(brand).trim() === 'ROYAL BLACK' ? 'Royal Black' :
  String(brand).trim() === 'YAZD' ? 'Yazd' :
  brand
);

/** Metric + flotation sizes: 205/55R16, 175/80-16, 31x10.5R15, 31*10.5-15. */
const parseTyreSize = (sizeStr) => {
  const raw = String(sizeStr ?? '').trim().replace(/,/g, '.');
  if (!raw) {
    return { width: 0, profile: 0, diameter: '' };
  }

  // 31x10.5R15 | 31x10.5-15 | 31*10.5-15
  let match = raw.match(
    /^(\d+(?:\.\d+)?)\s*[xXхХ*]\s*(\d+(?:\.\d+)?)\s*[rR\-–—]\s*(\d+)\s*([CcСс])?$/u
  );
  if (match) {
    const cargo = match[4] ? 'C' : '';
    return {
      width: Number(match[1]),
      profile: Number(match[2]),
      diameter: `R${match[3]}${cargo}`,
    };
  }

  // 205/55R16 | 175/80-16 | 215/90R15C | 185R14C
  match = raw.match(
    /^(\d+(?:\.\d+)?)(?:\s*[/.]\s*(\d+(?:\.\d+)?))?\s*[rR\-–—]\s*(\d+)\s*([CcСс])?$/u
  );
  if (match) {
    const cargo = match[4] ? 'C' : '';
    return {
      width: Number(match[1]),
      profile: match[2] != null ? Number(match[2]) : 0,
      diameter: `R${match[3]}${cargo}`,
    };
  }

  return { width: 0, profile: 0, diameter: '' };
};

/** Size token inside Наименование (R, hyphen, *, x). Avoid eating model codes like Я-245-1. */
const TYRE_SIZE_IN_TEXT_RE =
  /\d{2,3}\s*[\/xXхХ*]\s*\d+(?:\.\d+)?\s*[rR\-–—]\s*\d{2}[CcСс]?|\d{3}\s*[rR\-–—]\s*\d{2}[CcСс]?|\d{2}\s*[xXхХ*]\s*\d+(?:\.\d+)?\s*[rR\-–—]\s*\d{2}[CcСс]?/u;

const hasYearMarker = (str) => /(?:^|\s)год(?:\s|$)/i.test(String(str ?? ''));

const stripTyreNoise = (str) => {
  let result = String(str ?? '');

  result = result.replace(TYRE_SIZE_IN_TEXT_RE, ' ');
  result = result.replace(/\s*(?:шип\.?|нешипуемая\.?)\s*/gi, ' ');
  result = result.replace(/\(\s*кам\.?\s*\)/gi, ' ');
  result = result.replace(/(?:^|\s)кам\.(?=\s|$)/gi, ' ');
  // Duplicate brand in parentheses, e.g. (BFGoodrich)
  result = result.replace(/\(\s*[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё\s./&\-]*\s*\)/gu, ' ');
  result = result.replace(/^[CcСс](?=\s|$)\s*/u, '');
  result = result.replace(/\s+/g, ' ').trim();
  // Year marker handled separately for title — strip from model source
  result = result.replace(/(?:^|\s)год$/i, '').trim();

  return result;
};

const stripLeadingBrand = (text, brand) => {
  let rest = String(text ?? '').trim();
  const brandStr = String(brand ?? '').trim();
  if (!rest || !brandStr) return rest;

  const escaped = brandStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  rest = rest.replace(new RegExp(`^${escaped}(?=\\s|$)`, 'i'), '').trim();
  // "Кама Евро" raw vs normalized "Кама"
  rest = rest.replace(/^кама(?:\s+евро)?(?=\s|$)/i, '').trim();
  return rest;
};

const cleanTyreModelCandidate = (text, brand) => {
  let rest = stripTyreNoise(text);
  rest = stripLeadingBrand(rest, brand);
  // Raw model often still starts with un-normalized brand spellings
  rest = rest
    .replace(
      /^(?:кама(?:\s+евро)?|алтай(?:шина)?|волтайр|viatti|nexen|blackarrow|bfg(?:oodrich)?|roadcruza|voltyre)(?=\s|$)\s*/iu,
      ''
    )
    .trim();
  rest = rest.replace(/(?:^|\s)кам\.$/iu, '').trim();
  const { rest: withoutIdx } = extractLoadSpeedFromTitle(rest);
  rest = withoutIdx.replace(/\s+/g, ' ').trim();
  return normalizeModelText(rest);
};

const pickTyreModel = (rawModel, nameForModel, brand) => {
  const fromRaw = cleanTyreModelCandidate(rawModel, brand);
  const fromName = cleanTyreModelCandidate(nameForModel, brand);

  if (fromRaw && !/^\d+(?:[.,]\d+)?\s*[\/x*\-]/u.test(fromRaw)) {
    if (
      fromName
      && fromName.length > fromRaw.length + 2
      && fromName.toLowerCase().includes(fromRaw.toLowerCase())
    ) {
      return fromName;
    }
    return fromRaw;
  }
  return fromName || fromRaw;
};

const buildTyreTitle = (brand, model, indices, keepYear) => {
  const parts = [brand, model, indices].filter(Boolean);
  let title = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (keepYear) {
    title = `${title} год`.replace(/\s+/g, ' ').trim();
  }
  return title;
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
    const keepYear = hasYearMarker(tyre.Наименование);

    const nameStripped = stripTyreNoise(tyre.Наименование);
    const { indices, rest: nameWithoutIndices } = extractLoadSpeedFromTitle(nameStripped);
    const nameForModel = nameWithoutIndices;

    const model = pickTyreModel(tyre.Модель, nameForModel, normalizedBrand);
    const title = buildTyreTitle(normalizedBrand, model, indices, keepYear);

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
      supplier: 'Семисотнов',
    };
  });
};

const parseDiscDiameter = (diameter) => `R${diameter}`;
const STAMPED_DISC_BRANDS = new Set(['Better', 'R-STEEL', 'TREBL', 'ТЗСК', 'КрКЗ', 'Asterro', 'Mefro', 'ACCURIDE', 'Тайвань &amp; Китай', 'Нижний Новгород', 'KRONPRINZ', 'ARRIVO', 'SRW', 'Gold Wheel', 'LAND STAR', 'Jantsa', 'LEMMERZ']);
const parseDiskTypeByBrand = (brand) => (
  STAMPED_DISC_BRANDS.has(String(brand).trim()) ? 'Штампованный' : 'Литой'
);

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

const normalizeDiscBrand = (rawBrand) => {
  const brand = String(rawBrand ?? '').trim();
  const key = brand.toLowerCase();

  const brandMap = {
    'carwel': 'Carwel',
    'd&amp;p': 'D&P',
    'd&p': 'D&P',
    'k&amp;k': 'K&K',
    'k&k': 'K&K',
    'kronprinz': 'Kronprinz',
    'mefro': 'MEFRO (Аккурайд/KRONPRINZ)',
    'lemmerz': 'Lemmerz',
    'скад': 'SCAD',
    'yamoto segun': 'Yamato Segun',
  };

  return brandMap[key] || decodeHtmlEntities(brand);
};

const stripDiscBrandTokens = (text, brands) => {
  let rest = String(text ?? '').trim();
  const tokens = [...new Set(
    brands
      .flatMap((b) => {
        const decoded = decodeHtmlEntities(b);
        return [b, decoded].filter(Boolean).map((x) => String(x).trim());
      })
      .filter(Boolean)
  )].sort((a, b) => b.length - a.length);

  let changed = true;
  while (changed) {
    changed = false;
    for (const token of tokens) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i');
      if (re.test(rest)) {
        rest = rest.replace(re, ' ').replace(/\s+/g, ' ').trim();
        changed = true;
      }
    }
  }
  return rest;
};

const cleanDiscModel = (rawModel, rawBrand, normalizedBrand) => {
  let text = decodeHtmlEntities(rawModel);

  // Wheel size: 7.0*16, 8.5*20, 4.50*16E
  text = text.replace(/\d+\.\d+\s*[*xхXХ]\s*\d+[Ee]?/gu, ' ');
  // Integer width with typical rim diameter 13–22
  text = text.replace(/\b\d{1,2}\s*[*xхXХ]\s*(?:1[3-9]|2[0-2])\b/gu, ' ');
  // PCD slash / star with large second value
  text = text.replace(/\b\d{1,2}\s*\/\s*\d+(?:\.\d+)?\b/g, ' ');
  text = text.replace(/\b\d{1,2}\s*[*xхXХ]\s*\d{3}(?:\.\d+)?\b/gu, ' ');
  // ET / DIA / hub (Latin + Cyrillic ЕТ)
  text = text.replace(/[EeЕе][TtТт]\s*-?\d+(?:\.\d+)?/gu, ' ');
  text = text.replace(/(?:DIA|ЦО)\s*-?\d+(?:\.\d+)?/gi, ' ');
  text = text.replace(/\b[dDд]\s*\d+(?:\.\d+)?\b/gu, ' ');
  // Article noise
  text = text.replace(/\(\s*Арт\.?\s*\d+\s*\)/gi, ' ');
  text = text.replace(/\bАрт\.?\s*\d+\b/gi, ' ');
  text = text.replace(/\(\s*\d{4,}\s*\)/g, ' ');
  // Parenthetical brand echo: (скад), (K&K)
  text = text.replace(/\(\s*(?:скад|scad|k\s*&\s*k|r-?steel|trebl|carwel)\s*\)/gi, ' ');

  text = stripDiscBrandTokens(text, [rawBrand, normalizedBrand, 'K&K', 'K&k', 'R-Steel', 'R-STEEL', 'скад', 'Скад', 'SCAD']);
  text = text.replace(/\(\s*\)/g, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  // Trailing dots from "плат."
  text = text.replace(/\s*\.\s*$/g, '').trim();

  return normalizeModelText(text);
};

export const transformDiscs = (rawData) => {
  const discsArray = rawData.Выгрузка_Диски.Диск;
  if (!discsArray || !Array.isArray(discsArray)) {
    throw new Error('Неверная структура данных дисков от Семисотнова');
  }

  return discsArray.map((disc) => {
    const brand = normalizeDiscBrand(disc.Бренд);
    const model = cleanDiscModel(disc.Модель, disc.Бренд, brand);
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
    };
  });
};
