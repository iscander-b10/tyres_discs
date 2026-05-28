import { requestShinServiceDiscs, requestShinServiceTyres } from './request';
import { transformDiscs, transformTyres } from './transformers';

const shinservice = {
  key: 'shinservice',
  label: 'Шинсервис',
  fetchTyres: requestShinServiceTyres,
  fetchDiscs: requestShinServiceDiscs,
  transformTyres,
  transformDiscs,
};

export default shinservice;
