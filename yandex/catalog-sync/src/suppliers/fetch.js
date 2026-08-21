import { XMLParser } from 'fast-xml-parser';
import * as XLSX from 'xlsx';

const XML_ACCEPT = 'application/xml, text/xml, */*';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseNodeValue: true,
  parseAttributeValue: true,
  trimValues: true,
  parseTrueNumberOnly: false,
  arrayMode: false,
});

const DEFAULT_TIMEOUT_MS = 120000;

/**
 * Берёт URL из env: сначала CF-имя, затем REACT_APP_* (удобно копировать из .env.production).
 */
export function envUrl(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = Number(process.env.UPSTREAM_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(url) {
  if (!url) throw new Error('URL не задан');
  const res = await fetchWithTimeout(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchXmlJson(url) {
  if (!url) throw new Error('URL не задан');
  const res = await fetchWithTimeout(url, {
    method: 'GET',
    headers: { Accept: XML_ACCEPT },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xmlText = await res.text();
  return xmlParser.parse(xmlText);
}

export async function fetchExcelRows(url) {
  if (!url) throw new Error('URL не задан');
  const res = await fetchWithTimeout(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(worksheet);
}
