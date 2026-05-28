import { requestShinaSuData } from './request';
import { transformDiscs, transformTyres } from './transformers';

// Кэш для загруженных данных, чтобы не скачивать файл дважды в рамках одной сессии загрузки
let cachedData = null;

/**
 * Загружает и кэширует данные из Excel файла
 * Кэш очищается при следующем вызове загрузки данных
 */
const loadData = async () => {
  if (cachedData) {
    return cachedData;
  }
  cachedData = await requestShinaSuData();
  // Очищаем кэш после использования, чтобы при следующей загрузке данные обновились
  setTimeout(() => {
    cachedData = null;
  }, 1000);
  return cachedData;
};

/**
 * Загружает данные шин
 */
export const requestShinaSuTyres = async () => {
  const data = await loadData();
  return data;
};

/**
 * Загружает данные дисков
 */
export const requestShinaSuDiscs = async () => {
  const data = await loadData();
  return data;
};

const shinasu = {
  key: 'shinasu',
  label: 'ШинаСу',
  fetchTyres: requestShinaSuTyres,
  fetchDiscs: requestShinaSuDiscs,
  transformTyres,
  transformDiscs,
};

export default shinasu;

