import { fetchXmlJson } from '../shared/fetchXmlJson';

const TYRES_URL = process.env.REACT_APP_SEMISOTNOV_TYRES_URL;
const DISCS_URL = process.env.REACT_APP_SEMISOTNOV_DISCS_URL;

export const requestSemisotnovTyres = () => fetchXmlJson(TYRES_URL);

export const requestSemisotnovDiscs = () => fetchXmlJson(DISCS_URL);
