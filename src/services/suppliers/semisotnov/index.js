import { requestSemisotnovTyres, requestSemisotnovDiscs } from './request';
import { transformTyres, transformDiscs } from './transformers';

const semisotnov = {
  key: 'semisotnov',
  label: 'Семисотнов',
  fetchTyres: requestSemisotnovTyres,
  fetchDiscs: requestSemisotnovDiscs,
  transformTyres,
  transformDiscs,
};

export default semisotnov;

