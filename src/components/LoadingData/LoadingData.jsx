import React from 'react';
import { Alert, Button } from 'antd';
import { CloudDownloadOutlined } from '@ant-design/icons';
import indexedDBService from '../../services/indexedDBService';
import { loadAllSuppliersData } from '../../services/suppliers/supplierOrchestrator';
import { usesCorsProxy } from '../../utils/fetchSupplier';
import HoverTooltip from '../shared/HoverTooltip';
import './LoadingData.scss';

const LoadingData = ({ onDataLoaded }) => {
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

  const collectSaveTasks = (supplierData) => {
    const tasks = [];
    if (!supplierData) return tasks;

    const { label, tyres, discs } = supplierData;
    if (tyres?.length > 0) {
      tasks.push({
        label: `IndexedDB: шины (${label})`,
        promise: indexedDBService.saveTires(tyres),
      });
    }
    if (discs?.length > 0) {
      tasks.push({
        label: `IndexedDB: диски (${label})`,
        promise: indexedDBService.saveDiscs(discs),
      });
    }
    return tasks;
  };

  const handleLoadShinService = async () => {
    setLoading(true);
    setError(null);

    try {
      if (usesCorsProxy()) {
        console.info('Загрузка поставщиков по очереди (production + CORS-прокси)');
      }

      const results = await loadAllSuppliersData();

      const saveTasks = results
        .filter((r) => r.status === 'fulfilled' && r.value)
        .flatMap((r) => collectSaveTasks(r.value));

      let hadSaveErrors = false;

      if (saveTasks.length > 0) {
        const saveResults = await Promise.allSettled(saveTasks.map((t) => t.promise));
        saveResults.forEach((r, idx) => {
          if (r.status === 'rejected') {
            console.error(`${saveTasks[idx].label} — ошибка сохранения:`, r.reason);
          }
        });
        const saveErrors = saveResults
          .map((r, idx) =>
            r.status === 'rejected' ? `${saveTasks[idx].label}: ${getErrorMessage(r.reason)}` : null
          )
          .filter(Boolean)
          .join('; ');
        if (saveErrors) {
          hadSaveErrors = true;
          setError(`Ошибка при сохранении: ${saveErrors}`);
        }
      }

      const loadFailures = results
        .filter((r) => r.status === 'rejected')
        .map((r) => getErrorMessage(r.reason));

      if (loadFailures.length > 0) {
        const prefix = usesCorsProxy()
          ? 'Частичная загрузка (прокси)'
          : 'Частичная загрузка';
        setError((prev) =>
          prev
            ? `${prev}; ${prefix}: ${loadFailures.join(' | ')}`
            : `${prefix}: ${loadFailures.join(' | ')}`
        );
      } else if (onDataLoaded && !hadSaveErrors) {
        onDataLoaded();
      }
    } catch (err) {
      console.error('Ошибка при загрузке данных:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loading-data">
      <HoverTooltip title="Загрузить данные" placement="bottom">
        <Button
          className="load-data-button"
          icon={<CloudDownloadOutlined />}
          size="large"
          loading={loading}
          danger={Boolean(error)}
          onClick={handleLoadShinService}
          shape="circle"
        />
      </HoverTooltip>
      {error && (
        <Alert
          className="load-data-error"
          type="error"
          message="Ошибка загрузки"
          description={error}
          showIcon
          closable
          onClose={() => setError(null)}
        />
      )}
    </div>
  );
};

export default LoadingData;
