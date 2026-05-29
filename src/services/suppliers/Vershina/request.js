import { XMLParser } from 'fast-xml-parser';

const VERSHINA_URL = process.env.REACT_APP_VERSHINA_TYRES_URL;
const VERSHINA_DISCS_URL = process.env.REACT_APP_VERSHINA_DISCS_URL;

export const requestVershinaTyres = async () => {
  if (!VERSHINA_URL) {
    throw new Error('REACT_APP_VERSHINA_URL не определен в переменных окружения');
  }

  try {
    const response = await fetch(VERSHINA_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/xml, text/xml, */*',
        'Content-Type': 'application/xml',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      parseNodeValue: true,
      parseAttributeValue: true,
      trimValues: true,
      parseTrueNumberOnly: false,
    });

    return parser.parse(xmlText);
  } catch (error) {
    console.error('❌ Ошибка при загрузке данных Вершины:', error);
    throw new Error(`Не удалось загрузить данные Вершины: ${error.message}`);
  }
};

export const requestVershinaDiscs = async () => {
  try {
    const response = await fetch(VERSHINA_DISCS_URL, {
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
    console.error('❌ Ошибка при загрузке дисков Вершины:', err);
    throw new Error(`Не удалось загрузить данные дисков: ${err.message}`);
  }
};
