import { calculateSellingPrice, getMargin } from '../../dataTransformers';

export const transformTyres = (rawData) => {
  if (!rawData.tyre || !Array.isArray(rawData.tyre)) {
    throw new Error('Неверная структура данных от Шинсервис');
  }

  return rawData.tyre.map((tyre) => {
    let diameter = tyre.diameter;
    diameter = diameter.replace(/^r/i, 'R');
    if (diameter.endsWith('c')) {
      diameter = diameter.slice(0, -1) + 'C';
    }

    const newTitle = `${tyre.brand} ${tyre.model} ${tyre.loadIndex}${tyre.speedIndex}`;
    const sizeTitle = `${tyre.width}/${tyre.profile}${diameter}`;

    const margin = getMargin(tyre.brand);
    const sellingPrice = calculateSellingPrice(tyre.price, margin);

    return {
      id: `shinservice_${tyre.sku}`,
      code: tyre.sku,
      brand: tyre.brand,
      width: tyre.width,
      profile: tyre.profile,
      diameter,
      season: tyre.season,
      spikes: tyre.pins,
      amount: tyre.amountDetailed[0]?.total ?? tyre.amountTotal,
      title: newTitle,
      sizeTitle,
      price: tyre.price,
      websitePrice: tyre.priceRetail,
      sellingPrice,
      photoUrl: tyre.photoUrl,
      runflat: tyre.runflat,
      supplier: 'Шинсервис',
    };
  });
};

const parseDiscDiameter = (diameterString) => {
  const match = diameterString.match(/^(\d+)\s*\/\s*(\d+(?:\.\d+)?J)$/i);
  if (!match) return {};

  return {
    diameter: `R${match[1]}`,
    width: match[2],
  };
};

const parseDiscType = (typeString) => {
  const match = typeString?.match(/^(.+?)\s*\/\s*(.+)$/);
  if (!match) return {};

  let diskType = match[1].trim();
  const color = match[2].trim();

  // Замена "Стальной" → "Штампованный" (без учёта регистра)
  if (diskType.toLowerCase() === 'стальной') {
    diskType = 'Штампованный';
  }

  return {
    diskType,
    color,
  };
};

const normalizeDiscBrand = (rawBrand) => {
  const brand = String(rawBrand ?? '').trim();
  const key = brand.toLowerCase();

  const brandMap = {
    'asterro': 'Asterro',
    'khomen wheels': 'Khomen Wheels',
    'кик': 'K&K',
    'скад': 'SCAD',
  };

  return brandMap[key] || brand;   
};

export const transformDiscs = (rawData) => {
  if (!rawData.disk || !Array.isArray(rawData.disk)) {
    throw new Error('Неверная структура данных от Шинсервис');
  }

  return rawData.disk.map((disc) => {
    const { diameter: discDiameter, width: discWidth } = parseDiscDiameter(disc.diameter);
    const { diskType, color } = parseDiscType(disc.type);
    const brand = normalizeDiscBrand(disc.brand);             
    const newTitle = `${brand} ${disc.model}`;
    const sizeTitle = `${discDiameter} / ${discWidth} PCD ${disc.pn}x${disc.pcd} ET ${disc.et} ЦО ${disc.cb}`;

    return {
      id: `shinservice_${disc.sku}`,
      code: disc.sku,
      brand,                                                  
      diameter: discDiameter,
      width: discWidth,
      pn: disc.pn,
      pcd: disc.pcd,
      et: disc.et,
      cb: disc.cb,
      diskType,
      color,
      amount: disc.amountDetailed[0]?.total ?? disc.amountTotal,
      title: newTitle,
      sizeTitle,
      price: disc.price,
      websitePrice: disc.priceRetail,
      sellingPrice: Math.round(disc.price * 1.2),
      photoUrl: disc.photoUrl,
      supplier: 'Шинсервис',
    };
  });
};