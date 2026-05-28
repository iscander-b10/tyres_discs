const API_URL = process.env.REACT_APP_4TOCHKI_TYRES_URL;
export const requestFourtochkiTyres = async () => {
  const response = await fetch(API_URL, {cache: 'no-store'});
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
};
