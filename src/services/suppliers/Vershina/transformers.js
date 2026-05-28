import { calculateSellingPrice, getMargin } from '../../dataTransformers';

const normalizeBrand = (brand) => {
  const trimmed = String(brand).trim();
  if (trimmed === 'BFGOODRICH') return 'BFGoodrich';
  if (trimmed === 'KAVIR TIRE') return 'Kavir';
  if (trimmed === 'LEAO') return 'LingLong Leao';
  if (trimmed === 'NOKIAN TYRES') return 'Nokian Tyres';
  if (trimmed === 'ROADX') return 'RoadX';
  if (trimmed === 'БЕЛШИНА') return 'Belshina';
  if (trimmed === 'АШК') return 'Алтайшина';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

const parseDiameter = (diameter, commercial) => {
  const base = `R${diameter}`;
  return commercial === 'Да' ? `${base}C` : base;
};

const parseSeason = (season) => season === 'Зимние' ? 'w' : 's';
const parseSpikes = (spikes) => spikes === 'Да';
const parseRunflat = (value) => String(value ?? '').trim().toUpperCase().includes('ДА');

export const transformTyres = (rawData) => {
  const tyresArray = rawData.data.tyres;
  if (!tyresArray || !Array.isArray(tyresArray)) {
    throw new Error('Неверная структура данных шин от Вершины');
  }

  return tyresArray.map((tyre) => {
    const normalizedBrand = normalizeBrand(tyre.brand);
    const margin = getMargin(normalizedBrand);
    const sellingPrice = calculateSellingPrice(tyre.price_opt, margin);
    const rim = parseDiameter(tyre.diameter, tyre.commercial);
    const newTitle = `${normalizedBrand} ${tyre.model} ${tyre.load_speed_index}`;
    const sizeTitle = `${tyre.width}/${tyre.height}${rim}`; 
    return {
      id: `vershina_${tyre.cae}`,
      code: tyre.cae,
      brand: normalizedBrand,
      width: tyre.width,
      profile: tyre.height,
      diameter: rim,                                
      season: parseSeason(tyre.season),
      spikes: parseSpikes(tyre.thorn),
      amount: tyre.stock_krd_main + tyre.stock_stavropol,
      title: newTitle,
      sizeTitle,
      price: tyre.price_opt,
      websitePrice: tyre.price_mic,
      sellingPrice,
      photoUrl: tyre.photo,
      runflat: parseRunflat(tyre.runflat),
      supplier: 'Вершина',
    };
  });
};

const parseDiscType = (type) => {
  if (type === 'литой') return 'Литой';
  if (type === 'штампованный') return 'Штампованный';
  return ''; // или значение по умолчанию, если тип неизвестен
};

const normalizeDiscBrand = (rawBrand) => {
  const brand = String(rawBrand ?? '').trim();
  const key = brand.toLowerCase();

  const brandMap = {
    'alcasta': 'Alcasta',
    'asterro': 'Asterro',  
    'carwel': 'Carwel',
    'khomen': 'Khomen Wheels',
    'кик': 'K&K',
    'ifree': 'iFree',
    'skad': 'SCAD',
  };

  return brandMap[key] || brand;   
};

export const transformDiscs = (rawData) => {
  const discsArray = rawData.data.rims;
  if (!discsArray || !Array.isArray(discsArray)) {
    throw new Error('Неверная структура данных дисков от Вершины');
  }

  return discsArray.map((disc) => {
    const brand = normalizeDiscBrand(disc.brand); 
    const newTitle = `${brand} ${disc.model}`;
    const sizeTitle = `${parseDiameter(disc.rims_height)} / ${disc.rims_width}J PCD ${disc.rims_count_bolt}x${disc.rims_distance_bolt} ET ${disc.rims_et} ЦО ${disc.rims_hub}`;

    return {
      id: `vershina_${disc.cae}`,
      code: disc.cae,
      brand,                                
      diameter: parseDiameter(disc.rims_height),
      width: disc.rims_width,
      pn: disc.rims_count_bolt,
      pcd: disc.rims_distance_bolt,
      et: disc.rims_et,
      cb: disc.rims_hub,
      diskType: parseDiscType(disc.rims_type),
      color: disc.rims_color,
      amount: disc.stock_krd_main + disc.stock_stavropol,
      title: newTitle,
      sizeTitle,
      price: disc.price_opt,
      websitePrice: disc.price_mic,
      sellingPrice: Math.round(disc.price_mic * 1.2),
      photoUrl: disc.photo,
      supplier: 'Вершина'
    };
  });
};