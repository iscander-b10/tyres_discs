import { calculateSellingPrice, getMargin } from '../../dataTransformers';
import { deriveModelFromTitle, normalizeModelText } from '../shared/deriveModel';

const parseSeason = (season) => season === 'Зимняя' ? 'w' : 's';
const parseSpikes = (spikes) => spikes === 'Да';
const parseRunflat = (value) => String(value ?? '').trim().toUpperCase().includes('ДА');
const parseRestKrd = (value) => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  const str = String(value ?? '').trim();
  if (!str) {
    return 0;
  }

  if (/более/i.test(str)) {
    const match = str.match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  const num = Number(str);
  return Number.isNaN(num) ? 0 : num;
};
const normalizeBrand = (brand) => (
  String(brand).trim() === 'Hankook Laufenn' ? 'Laufenn' : 
  String(brand).trim() === 'HiFly' ? 'Hifly' : 
  String(brand).trim() === 'Kama' ? 'Кама' : 
  String(brand).trim() === 'Pirelli Formula' ? 'Formula' :
  String(brand).trim() === 'Sailun RoadX' ? 'RoadX' :
  brand
);

export const transformTyres = (rawData) => {
  if (!rawData.tires || !Array.isArray(rawData.tires)) {
    throw new Error('Неверная структура данных от Форточек');
  }
  return rawData.tires.map((tyre) => {
      const normalizedBrand = normalizeBrand(tyre.brand);
      const model = deriveModelFromTitle(tyre.model, normalizedBrand, { stripIndices: false });
      const margin = getMargin(normalizedBrand);
      const sellingPrice = calculateSellingPrice(tyre.price_krd, margin);
      const newTitle = `${normalizedBrand} ${model ?? ''} ${tyre.load_index}${tyre.speed_index}`.replace(/\s+/g, ' ').trim();
      const normalizeDiameter = (diameter) => {
        let d = String(diameter).replace(/Z/gi, ''); // убираем Z (в любом регистре)
        d = d.trim();
        // Если строка начинается с тире/дефиса/длинного тире – заменяем на 'R'
        if (/^[-—–]/.test(d)) {
          d = 'R' + d.replace(/^[-—–]+/, '');
        }
      return d;
    };
const parseTyresDiameter = normalizeDiameter(tyre.diameter);
      const sizeTitle = `${tyre.width}/${tyre.height}${parseTyresDiameter}`;
      
      return {
        id: `fourtochki_${tyre.cae}`,
        code: tyre.cae,
        brand: normalizedBrand,
        model,
        width: tyre.width,
        profile: tyre.height,
        diameter: parseTyresDiameter,
        season: parseSeason(tyre.season),
        spikes: parseSpikes(tyre.thorn),
        amount: parseRestKrd(tyre.rest_krd),
        title: newTitle,
        sizeTitle,
        price: tyre.price_krd,
        websitePrice: tyre.price_krd_rozn,
        sellingPrice,
        photoUrl: tyre.img_big_my,
        runflat: parseRunflat(tyre.runflat),
        supplier: 'Форточки',
      };
    });
};

const parseDiscDiameter = (diameter) => `R${diameter}`;
const parseDiscWidth = (width) => `${width}J`;
const normalizeDiscBrand = (rawBrand) => {
  const brand = String(rawBrand ?? '').trim();
  const key = brand.toLowerCase();

  const brandMap = {
    'trebl': 'TREBL',
    'neo': 'NEO',
    'скад': 'SCAD',
    'skad original': 'SCAD',
  };

  return brandMap[key] || brand;  
}
export const transformDiscs = (rawData) => {
  if (!rawData.rims || !Array.isArray(rawData.rims)) {
    throw new Error('Неверная структура данных от Форточек');
  }
  return rawData.rims.map((disc) => {
      const brand = normalizeDiscBrand(disc.brand);
      const model = normalizeModelText(disc.model);
      const newTitle = `${brand} ${model ?? ''}`.replace(/\s+/g, ' ').trim();
      const sizeTitle = `${parseDiscDiameter(disc.diameter)} / ${parseDiscWidth(disc.width)} PCD ${disc.bolts_count}x${disc.bolts_spacing} ET ${disc.et} ЦО ${disc.dia}`;
      const newColor = `${disc.color} ${disc.rim_base_color}`;
      
      return {
        id: `fourtochki_${disc.cae}`,
        code: disc.cae,
        brand,
        model,
        diameter: parseDiscDiameter(disc.diameter),
        width: disc.width,
        pn: disc.bolts_count,
        pcd: disc.bolts_spacing,
        et: disc.et,
        cb: disc.dia,
        diskType: disc.rim_type,
        color: newColor,
        amount: parseRestKrd(disc.rest_krd),
        title: newTitle,
        sizeTitle,
        price: disc.price_krd,
        websitePrice: disc.price_krd_rozn,
        sellingPrice: Math.round(disc.price_krd * 1.2),
        photoUrl: disc.img_big_my,
        supplier: 'Форточки',
      };
    });
};


