import { fetchWithRetry } from '../../../utils/fetchSupplier';

const API_URL = process.env.REACT_APP_SHINSERVICE_TYRES_URL?.trim() || '';
const DISC_API_URL = process.env.REACT_APP_SHINSERVICE_DISCS_URL?.trim() || '';

export const requestShinServiceTyres = async () => {
  if (!API_URL) {
    throw new Error('REACT_APP_SHINSERVICE_TYRES_URL не определен в переменных окружения');
  }

  const response = await fetchWithRetry(API_URL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
};

export const requestShinServiceDiscs = async () => {
  if (!DISC_API_URL) {
    throw new Error('REACT_APP_SHINSERVICE_DISCS_URL не определен в переменных окружения');
  }

  const response = await fetchWithRetry(DISC_API_URL);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
};
