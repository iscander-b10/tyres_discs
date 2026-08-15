import { fetchXmlJson } from '../shared/fetchXmlJson';

const VERSHINA_URL = process.env.REACT_APP_VERSHINA_TYRES_URL;
const VERSHINA_DISCS_URL = process.env.REACT_APP_VERSHINA_DISCS_URL;

export const requestVershinaTyres = () => {
  if (!VERSHINA_URL) {
    throw new Error('REACT_APP_VERSHINA_URL не определен в переменных окружения');
  }
  return fetchXmlJson(VERSHINA_URL);
};

export const requestVershinaDiscs = () => fetchXmlJson(VERSHINA_DISCS_URL);
