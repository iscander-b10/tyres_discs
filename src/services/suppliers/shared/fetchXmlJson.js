import { XMLParser } from 'fast-xml-parser';
import { fetchSupplier } from '../../../utils/fetchSupplier';

const XML_ACCEPT = 'application/xml, text/xml, */*';

const XML_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseNodeValue: true,
  parseAttributeValue: true,
  trimValues: true,
  parseTrueNumberOnly: false,
  arrayMode: false,
};

const xmlParser = new XMLParser(XML_PARSER_OPTIONS);

/**
 * GET XML у поставщика и разбор в JSON (общий шаблон для Семисотнов / Вершина).
 */
export async function fetchXmlJson(url) {
  const response = await fetchSupplier(url, {
    method: 'GET',
    headers: {
      Accept: XML_ACCEPT,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const xmlText = await response.text();
  return xmlParser.parse(xmlText);
}
