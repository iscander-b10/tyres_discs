const IMPORT_BRANDS = [
  'Ikon', 'Pirelli', 'Formula', 'Gislaved', 'Nokian Tyres', 'Torero', 
  'Kumho', 'Hankook', 'Michelin', 'Bridgestone', 'Continental', 
  'Goodyear', 'Yokohama', 'BFGoodrich', 'Dunlop', 'Marshal', 
  'Laufenn', 'Matador', 'Roadstone', 'Tigar', 'Toyo', 'Nexen', 'Petlas'
];

const RUSSIAN_BRANDS = ['Кама', 'Viatti', 'Tunga', 'Cordiant', 'Belshina',
  'Voltyre', 'Алтайшина', 'Кировский ШЗ', 'Rosava'
];

export const getMargin = (brand) => {
  const brandNormalized = brand.trim().toLowerCase();
  
  if (RUSSIAN_BRANDS.find(b => b.toLowerCase() === brandNormalized)) return 15;
  if (IMPORT_BRANDS.find(b => b.toLowerCase() === brandNormalized)) return 23;
  
  return 18;
};

export const calculateSellingPrice = (price, margin) => {
  if (!price || price <= 0) return 0;
  const sellingPrice = price * (1 + margin / 100);
  return Math.round(sellingPrice);
};