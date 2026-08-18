import React from 'react';
import { App, Button } from 'antd';
import { CloudDownloadOutlined } from '@ant-design/icons';
import indexedDBService from '../../services/indexedDBService';
import {
  getSupplierLabel,
  loadAllSuppliersData,
  PART_DISCS,
  PART_TYRES,
} from '../../services/suppliers/supplierOrchestrator';
import {
  compactSupplierLoadResults,
  createCatalogLoadId,
  reportCatalogLoadMetric,
  usesCorsProxy,
} from '../../utils/fetchSupplier';
import HoverTooltip from '../shared/HoverTooltip';
import './LoadingData.scss';

const SUCCESS_DURATION_SEC = 5;
const ERROR_DURATION_SEC = 0; // до закрытия вручную (ошибки не должны исчезать сами)

function formatLoadedAt(date = new Date()) {
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function messageForFailedPart(supplierLabel, part) {
  if (part === PART_TYRES) {
    return `Не загрузились шины: ${supplierLabel}.`;
  }
  if (part === PART_DISCS) {
    return `Не загрузились диски: ${supplierLabel}.`;
  }
  return `Не загрузился поставщик: ${supplierLabel}.`;
}

function collectClientLoadErrors(results) {
  const messages = [];

  results.forEach((result) => {
    if (result.status === 'rejected') {
      const label = result.reason?.supplierLabel || getSupplierLabel(result.key);
      const parts = result.reason?.failedParts;

      if (Array.isArray(parts) && parts.length > 0) {
        parts.forEach((part) => {
          messages.push(messageForFailedPart(label, part));
        });
      } else {
        messages.push(`Не загрузился поставщик: ${label}.`);
      }

      console.error(`Ошибка загрузки (${result.key}):`, result.reason);
      return;
    }

    const failedParts = result.value?.failedParts;
    if (!Array.isArray(failedParts) || failedParts.length === 0) return;

    const label = result.value.label || getSupplierLabel(result.key);
    failedParts.forEach((part) => {
      messages.push(messageForFailedPart(label, part));
    });
  });

  return messages;
}

function notifySuccess(notification) {
  const when = formatLoadedAt();
  notification.success({
    key: 'catalog-load-success',
    message: 'Поставщики загружены',
    description: `Данные от ${when}`,
    placement: 'topRight',
    duration: SUCCESS_DURATION_SEC,
  });
}

function notifyLoadErrors(notification, messages) {
  notification.error({
    key: 'catalog-load-errors',
    message: 'Ошибка загрузки',
    description: (
      <div className="load-data-toast-list">
        {messages.map((text) => (
          <p key={text} className="load-data-toast-line">
            {text}
          </p>
        ))}
      </div>
    ),
    placement: 'topRight',
    duration: ERROR_DURATION_SEC,
  });
}

function notifySaveError(notification) {
  notification.error({
    key: 'catalog-save-errors',
    message: 'Ошибка сохранения',
    description: 'Не удалось сохранить загруженные данные. Попробуйте ещё раз.',
    placement: 'topRight',
    duration: ERROR_DURATION_SEC,
  });
}

const LoadingData = ({ onDataLoaded }) => {
  const { notification } = App.useApp();
  const [loading, setLoading] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);

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
    setHasError(false);
    notification.destroy('catalog-load-success');
    notification.destroy('catalog-load-errors');
    notification.destroy('catalog-save-errors');

    const loadId = createCatalogLoadId();
    reportCatalogLoadMetric({ event: 'load-start', loadId });

    const finishPayload = {
      event: 'load-finish',
      loadId,
      ok: false,
      hadClientErrors: true,
      hadSaveErrors: false,
      suppliers: '',
    };

    try {
      if (usesCorsProxy()) {
        console.info('Загрузка поставщиков по очереди (production + CORS-прокси)');
      }

      const results = await loadAllSuppliersData();
      finishPayload.suppliers = compactSupplierLoadResults(results);

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
        hadSaveErrors = saveResults.some((r) => r.status === 'rejected');
        if (hadSaveErrors) {
          setHasError(true);
          notifySaveError(notification);
        }
      }

      const clientErrors = collectClientLoadErrors(results);
      const hasRejectedSupplier = results.some((r) => r.status === 'rejected');
      const hadClientErrors = clientErrors.length > 0;
      const ok = !hadClientErrors && !hadSaveErrors && !hasRejectedSupplier;

      finishPayload.ok = ok;
      finishPayload.hadClientErrors = hadClientErrors;
      finishPayload.hadSaveErrors = hadSaveErrors;

      if (hadClientErrors) {
        setHasError(true);
        notifyLoadErrors(notification, clientErrors);
      } else if (!hadSaveErrors) {
        notifySuccess(notification);
      }

      if (onDataLoaded && !hasRejectedSupplier && !hadSaveErrors) {
        onDataLoaded();
      }
    } catch (err) {
      console.error('Ошибка при загрузке данных:', err);
      setHasError(true);
      notifyLoadErrors(notification, ['Не удалось загрузить данные. Попробуйте ещё раз.']);
    } finally {
      reportCatalogLoadMetric(finishPayload);
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
          danger={hasError}
          onClick={handleLoadShinService}
          shape="circle"
          aria-label="Загрузить данные"
        />
      </HoverTooltip>
    </div>
  );
};

export default LoadingData;
