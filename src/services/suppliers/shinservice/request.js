const API_URL = process.env.REACT_APP_SHINSERVIVE_TYRES_URL;
const DISC_API_URL = process.env.REACT_APP_SHINSERVIVE_DISCS_URL;

export const requestShinServiceTyres = async () => {
  
  if (!API_URL) {
    throw new Error('REACT_APP_SHINSERVIVE_TYRES_URL не определен в переменных окружения');
  }
  
  const response = await fetch(API_URL);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
};

export const requestShinServiceDiscs = async () => {
  
  if (!DISC_API_URL) {
    throw new Error('REACT_APP_SHINSERVIVE_DISC_URL не определен в переменных окружения');
  }
  
  const response = await fetch(DISC_API_URL);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data;
};