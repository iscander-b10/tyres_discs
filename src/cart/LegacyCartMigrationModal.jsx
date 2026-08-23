import React, { useEffect, useState } from 'react';
import { Alert, Modal, Typography } from 'antd';
import {
  detectLegacyCart,
  discardLegacyCart,
  migrateLegacyCart,
} from './legacyCartMigration';

export function LegacyCartMigrationModal({
  accountId,
  generation,
  storage = window.localStorage,
  isCurrent,
  onMigrated,
}) {
  const [detection, setDetection] = useState(null);
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setError('');
    setDetection(accountId ? detectLegacyCart(storage, accountId) : null);
  }, [accountId, generation, storage]);

  if (!detection) return null;

  const remove = () => {
    setIsPending(true);
    setError('');
    try {
      discardLegacyCart(storage, detection);
      if (isCurrent()) setDetection(null);
    } catch {
      if (isCurrent()) setError('Не удалось удалить старую корзину.');
    } finally {
      if (isCurrent()) setIsPending(false);
    }
  };

  const migrate = () => {
    setIsPending(true);
    setError('');
    try {
      const envelope = migrateLegacyCart(storage, detection);
      if (!isCurrent()) return;
      onMigrated(envelope);
      setDetection(null);
    } catch {
      if (isCurrent()) {
        setError(
          'Не удалось перенести корзину. Старые данные сохранены, попробуйте ещё раз.'
        );
      }
    } finally {
      if (isCurrent()) setIsPending(false);
    }
  };

  const isCorrupted = detection.status === 'corrupted';
  return (
    <Modal
      open
      title="Найдена старая корзина"
      okText="Перенести"
      cancelText="Удалить"
      onOk={migrate}
      onCancel={remove}
      okButtonProps={{ disabled: isCorrupted }}
      confirmLoading={isPending}
      cancelButtonProps={{ disabled: isPending }}
      closable={false}
      maskClosable={false}
      keyboard={false}
    >
      {isCorrupted ? (
        <Alert
          type="warning"
          showIcon
          message="Данные старой корзины повреждены"
          description="Перенести их безопасно нельзя. Можно удалить повреждённые данные."
        />
      ) : (
        <Typography.Paragraph>
          Перенести товары из старой корзины в вашу персональную корзину?
        </Typography.Paragraph>
      )}
      {error ? (
        <Alert type="error" showIcon message={error} />
      ) : null}
    </Modal>
  );
}
