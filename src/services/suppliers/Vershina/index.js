import { requestVershinaTyres, requestVershinaDiscs } from './request';
import { transformDiscs, transformTyres } from './transformers';

const vershina = {
  key: 'vershina',
  label: 'Вершина',
  fetchTyres: requestVershinaTyres,
  fetchDiscs: requestVershinaDiscs,
  transformTyres,
  transformDiscs,
};

export default vershina;
