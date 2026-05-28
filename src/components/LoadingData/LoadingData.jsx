import React from 'react';
import { Button } from 'antd';
import { CloudDownloadOutlined } from '@ant-design/icons';
import indexedDBService from '../../services/indexedDBService';
import { loadSupplierData } from '../../services/suppliers/supplierOrchestrator';
import './LoadingData.scss';

const LoadingData = ({ onDataLoaded, form }) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const getErrorMessage = (e) => {
    if (!e) return 'Неизвестная ошибка';
    if (typeof e === 'string') return e;
    if (e instanceof Error) return e.message || 'Неизвестная ошибка';
    if (typeof e === 'object' && typeof e.message === 'string' && e.message) return e.message;
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  };

  const handleLoadShinService = async () => {
    setLoading(true);
    setError(null);

    try {
      // Загружаем данные от обоих поставщиков параллельно
      // Используем allSettled, чтобы обработать результаты независимо от успешности
      const results = await Promise.allSettled([
        loadSupplierData('shinservice'), // Шинсервис: шины и диски
        loadSupplierData('semisotnov'),
        loadSupplierData('fourtochki'), // Форточки: шины
        loadSupplierData('shinasu'), // ШинаСу: шины и диски
        loadSupplierData('vershina') // Вершина: пока смотрим сырой ответ
      ]);
      
      const shinserviceData = results[0].status === 'fulfilled' ? results[0].value : null;
      const semisotnovData = results[1].status === 'fulfilled' ? results[1].value : null;
      const fourtochkiData = results[2].status === 'fulfilled' ? results[2].value : null;
      const shinasuData = results[3].status === 'fulfilled' ? results[3].value : null;
      const vershinaData = results[4].status === 'fulfilled' ? results[4].value : null;
      
      // Логируем ошибки, если они есть
      if (results[0].status === 'rejected') {
        console.error('Ошибка при загрузке данных от Шинсервиса:', results[0].reason);
      }
      if (results[1].status === 'rejected') {
        console.error('Ошибка при загрузке данных от Семисотнова:', results[1].reason);
      }
      if (results[2].status === 'rejected') {
        console.error('Ошибка при загрузке данных от Форточек:', results[2].reason);
      }
      if (results[3].status === 'rejected') {
        console.error('Ошибка при загрузке данных от ШинаСу:', results[3].reason);
      }
      if (results[4].status === 'rejected') {
        console.error('Ошибка при загрузке данных от Вершины:', results[4].reason);
      }
      
      // Сохраняем все данные в indexedDB (только те, что успешно загружены)
      const saveTasks = [];
      let hadSaveErrors = false;
      
      if (shinserviceData) {
        if (shinserviceData.tyres && shinserviceData.tyres.length > 0) {
          saveTasks.push({
            label: 'IndexedDB: шины (Шинсервис)',
            promise: indexedDBService.saveTires(shinserviceData.tyres),
          });
        }
        if (shinserviceData.discs && shinserviceData.discs.length > 0) {
          saveTasks.push({
            label: 'IndexedDB: диски (Шинсервис)',
            promise: indexedDBService.saveDiscs(shinserviceData.discs),
          });
        }
      }

      if (semisotnovData) {
        if (semisotnovData.tyres && semisotnovData.tyres.length > 0) {
          saveTasks.push({
            label: 'IndexedDB: шины (Семисотнов)',
            promise: indexedDBService.saveTires(semisotnovData.tyres),
          });
        }
        if (semisotnovData.discs && semisotnovData.discs.length > 0) {
          saveTasks.push({
            label: 'IndexedDB: диски (Семисотнов)',
            promise: indexedDBService.saveDiscs(semisotnovData.discs),
          });
        }
      }

      if (fourtochkiData) {
        if (fourtochkiData.tyres && fourtochkiData.tyres.length > 0) {
          saveTasks.push({
            label: 'IndexedDB: шины (Форточки)',
            promise: indexedDBService.saveTires(fourtochkiData.tyres),
          });
        }
        if (fourtochkiData.discs && fourtochkiData.discs.length > 0) {
          saveTasks.push({
            label: 'IndexedDB: диски (Форточки)',
            promise: indexedDBService.saveDiscs(fourtochkiData.discs),
          });
        }
      }

      if (shinasuData) {
        if (shinasuData.tyres && shinasuData.tyres.length > 0) {
          saveTasks.push({
            label: 'IndexedDB: шины (ШинаСу)',
            promise: indexedDBService.saveTires(shinasuData.tyres),
          });
        }
        if (shinasuData.discs && shinasuData.discs.length > 0) {
          saveTasks.push({
            label: 'IndexedDB: диски (ШинаСу)',
            promise: indexedDBService.saveDiscs(shinasuData.discs),
          });
        }
      }

      if (vershinaData) {
        if (vershinaData.tyres && vershinaData.tyres.length > 0) {
          saveTasks.push({
            label: 'IndexedDB: шины (Вершина)',
            promise: indexedDBService.saveTires(vershinaData.tyres),
          });
        }
        if (vershinaData.discs && vershinaData.discs.length > 0) {
          saveTasks.push({
            label: 'IndexedDB: диски (Вершина)',
            promise: indexedDBService.saveDiscs(vershinaData.discs),
          });
        }
      }
      
      if (saveTasks.length > 0) {
        const saveResults = await Promise.allSettled(saveTasks.map(t => t.promise));
        saveResults.forEach((r, idx) => {
          if (r.status === 'rejected') {
            console.error(`${saveTasks[idx].label} — ошибка сохранения:`, r.reason);
          }
        });
        const saveErrors = saveResults
          .map((r, idx) => (r.status === 'rejected' ? `${saveTasks[idx].label}: ${getErrorMessage(r.reason)}` : null))
          .filter(Boolean)
          .join('; ');
        if (saveErrors) {
          hadSaveErrors = true;
          setError(`Ошибка при сохранении данных: ${saveErrors}`);
        }
      }
      
      // Проверяем, были ли ошибки
      const hasErrors = results.some(r => r.status === 'rejected');
      if (hasErrors) {
        const errorMessages = results
          .filter(r => r.status === 'rejected')
          .map(r => r.reason?.message || 'Неизвестная ошибка')
          .join('; ');
        setError(prev => prev ? `${prev}; Частичная загрузка: ${errorMessages}` : `Частичная загрузка: ${errorMessages}`);
      } else {
        // Вызываем callback только при успешной загрузке без ошибок
        if (onDataLoaded && !hadSaveErrors) {
          onDataLoaded();
        }
      }
      
      if (form) {
        form.resetFields();
      }
      
    } catch (err) {
      console.error('Ошибка при загрузке данных:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false); 
    }
  };

  return (
    <Button 
      className="load-data-button"
      icon={<CloudDownloadOutlined />}
      size="large"
      loading={loading} 
      onClick={handleLoadShinService}
      shape="circle"
    />
  );
};

export default LoadingData;