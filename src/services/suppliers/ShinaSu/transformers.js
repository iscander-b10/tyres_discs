import { calculateSellingPrice, getMargin } from '../../dataTransformers';
import { normalizeModelText } from '../shared/deriveModel';

const normalizeBrand = (brand) => (
  String(brand).trim() === 'IKON TYRES' ? 'Ikon' : 
  String(brand).trim() === 'CONTYRE' ? 'Contyre' : 
  String(brand).trim() === 'Leao' ? 'LingLong Leao' : 
  String(brand).trim() === 'KAMA' ? 'Кама' : 
  String(brand).trim() === 'АШК' ? 'Алтайшина' : 
  brand
);

const parsePrice = (priceStr) => {
  return parseInt(priceStr.split('.')[0], 10);
};

const parseSeason = (seasonStr) => seasonStr.includes('зим') ? 'w' : 's';

const parseSpikes = (value) => {
  // if (value == null) return false;
  const str = String(value).trim().toUpperCase();
  return str.includes('ДА');
};

const isCommercialTyre = (row) => {
  const group = String(row['Номенклатура']).trim().toUpperCase();
  return group.includes('(C)');
};

const parseDiameter = (diametr, isCommercial = false) => {
  const normalized = String(diametr).replace(',', '.');
  return isCommercial ? `R${normalized}C` : `R${normalized}`;
}

const parseIndexLoad = (il) => il.split('/')[0];

const parseIndexSpeed = (is) => is.split('/')[0];
/**
 * Преобразует данные шин
 */
export const transformTyres = (rawData) => {
  if (!Array.isArray(rawData)) {
    throw new Error('Неверная структура данных от ШинаСу');
  }

  // Фильтруем только легковые шины и убираем пустые строки
  const tyresData = rawData.filter(row => {
    const group = String(row['Номенклатурная группа'] || '').trim();
    const code = String(row['Код'] || '').trim();
    return group === 'Легковые шины' && code;
  });

  return tyresData.map((tyre) => {
    const code = String(tyre['Код']).trim();
    const normalizedBrand = normalizeBrand(String(tyre['Бренд']).trim());
    const model = normalizeModelText(tyre['Модель']);
    const season = parseSeason(tyre['Сезонность']);
    const loadIndex = parseIndexLoad(tyre['Индекс нагрузки']).trim();
    const speedIndex = parseIndexSpeed(tyre['Индекс скорости']).trim();
    const profile = tyre['Высота'];
    const width = tyre['Ширина'];
    const isCommercial = isCommercialTyre(tyre);                    
    const diameter = parseDiameter(tyre['Диаметр'], isCommercial);
    const spikes = parseSpikes(tyre['Наличие шипов']);
    const photoUrl = String(tyre['Фото']).trim();
    const price = parsePrice(tyre['Цена']);
    const amount = String(tyre['Количество']);
    

    // Новый title: бренд + модель + индекс нагрузки и скорости
    const title = `${normalizedBrand} ${model ?? ''} ${loadIndex}${speedIndex}`.replace(/\s+/g, ' ').trim();

    // sizeTitle: ширина/профиль + диаметр (например, "205/55R16")
    let sizeTitle = '';
    if (width && profile && diameter) {
      sizeTitle = `${width}/${profile}${diameter}`;
    }
  
    const margin = getMargin(normalizedBrand);
    const sellingPrice = calculateSellingPrice(price, margin);

    return {
      id: `shinasu_${code}`,
      code,
      width,
      profile,
      diameter,
      season,
      brand: normalizedBrand,
      model,
      title,
      sizeTitle,       
      price,
      sellingPrice,
      amount,
      photoUrl,
      spikes,
      supplier: 'ШинаСу',
    };
  });
};

const parseNumber = (value) => {
  const normalized = String(value).trim().replace(',', '.');
  const num = parseFloat(normalized);
  return num;
};

const parseDIA = (dia) => parseNumber(dia);

const parsePCD = (pcd) => parseNumber(pcd);

const normalizeDiscBrand = (brand) => (
  String(brand).trim() === 'Accuride Wheels' ? 'ACCURIDE' : 
  String(brand).trim() === 'SKAD' ? 'SCAD' : 
  brand
);
/**
 * Преобразует данные дисков
 */
export const transformDiscs = (rawData) => {
  if (!Array.isArray(rawData)) {
    throw new Error('Неверная структура данных от ШинаСу');
  }

  // Фильтруем только диски и убираем пустые строки
  const discsData = rawData.filter(row => {
    const group = String(row['Номенклатурная группа'] || '').trim();
    const code = String(row['Код'] || '').trim();
    return group === 'Диски' && code; // Проверяем, что есть код
  });

  return discsData.map((disc) => {
    const code = disc['Код'];
    const brand = normalizeDiscBrand(disc['Бренд']);
    const model = normalizeModelText(disc['Модель']);
    const width = disc['Ширина'];
    const diameter = parseDiameter(disc['Диаметр']);
    const diskType = disc['Тип диска'];
    const dia = parseDIA(disc['DIA']);
    const et = disc['Вылет'];
    const color = disc['Цвет'];
    const pn = disc['Количество болтов'];
    const pcd = parsePCD(disc['Диаметр отверстий']);
    const photoUrl = disc['Фото'];
    const price = parsePrice(disc['Цена']);
    const amount = disc['Количество'];

    // Создаем title из бренда и модели
    const title = `${brand} ${model ?? ''}`.replace(/\s+/g, ' ').trim();
    const sizeTitle = `${diameter} / ${width}J PCD ${pn}x${pcd} ET ${et} ЦО ${dia}`;

    return {
      id: `shinasu_${code}`,
      code,
      brand,
      model,
      diameter,
      width,
      pn,
      pcd,
      et,
      cb: dia,
      diskType,
      color,
      amount,
      title,
      sizeTitle,
      price,
      sellingPrice: Math.round(price * 1.2),
      photoUrl,
      supplier: 'ШинаСу',
    };
  });
};
