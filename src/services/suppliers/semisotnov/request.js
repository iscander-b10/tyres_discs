import { XMLParser } from 'fast-xml-parser';

const TYRES_URL = process.env.REACT_APP_SEMISOTNOV_TYRES_URL;
const DISCS_URL = process.env.REACT_APP_SEMISOTNOV_DISCS_URL;

export const requestSemisotnovTyres = async () => {
  try {
    const response = await fetch(TYRES_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml, text/xml, */*',
        'Content-Type': 'application/xml',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();

    const parserOptions = {
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      allowBooleanAttributes: true,
      parseNodeValue: true,
      parseAttributeValue: true,
      trimValues: true,
      parseTrueNumberOnly: false,
      arrayMode: false
    };

    const parser = new XMLParser(parserOptions);
    const jsonData = parser.parse(xmlText);
    
    return jsonData;
  } catch (err) {
    console.error('❌ Ошибка при загрузке через прокси:', err);
    throw new Error(`Не удалось загрузить данные: ${err.message}`);
  }
};

export const requestSemisotnovDiscs = async () => {
  try {
    const response = await fetch(DISCS_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml, text/xml, */*',
        'Content-Type': 'application/xml',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();

    const parserOptions = {
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      allowBooleanAttributes: true,
      parseNodeValue: true,
      parseAttributeValue: true,
      trimValues: true,
      parseTrueNumberOnly: false,
      arrayMode: false
    };

    const parser = new XMLParser(parserOptions);
    const jsonData = parser.parse(xmlText);
    
    return jsonData;
  } catch (err) {
    console.error('❌ Ошибка при загрузке дисков через прокси:', err);
    throw new Error(`Не удалось загрузить данные дисков: ${err.message}`);
  }
};