import * as XLSX from 'xlsx';
import { fetchSupplier } from '../../../utils/fetchSupplier';

const SHINASU_EXCEL_URL = process.env.REACT_APP_SHINASU_URL;

export const requestShinaSuData = async () => {
  if (!SHINASU_EXCEL_URL) {
    throw new Error('REACT_APP_SHINASU_URL не определен в переменных окружения');
  }

  try {
    const response = await fetchSupplier(SHINASU_EXCEL_URL, { cache: 'no-store' });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    return jsonData;
  } catch (error) {
    console.error('Ошибка при загрузке и парсинге Excel файла от ШинаСу:', error);
    throw error;
  }
};

