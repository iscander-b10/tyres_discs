import { requestShinaSuData } from './request';
import { transformDiscs, transformTyres } from './transformers';

/**
 * Одна загрузка Excel: в файле и шины, и диски.
 * Диски получаются из того же raw через transformDiscs в оркестраторе.
 */
const shinasu = {
  key: 'shinasu',
  label: 'ШинаСу',
  fetchTyres: requestShinaSuData,
  transformTyres,
  transformDiscs,
};

export default shinasu;
