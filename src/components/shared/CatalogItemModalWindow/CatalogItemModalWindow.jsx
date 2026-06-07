import React, { useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { resolvePhotoUrl } from '../../../utils/fetchSupplier';
import './CatalogItemModalWindow.scss';

const CatalogItemModalWindow = ({ isOpen, onClose, item }) => {
  // Блокируем скролл body
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Escape для закрытия
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const photoSrc = useMemo(
    () => (item ? resolvePhotoUrl(item.photoUrl, item.supplier) : ''),
    [item?.photoUrl, item?.supplier]
  );

  // Закрытие по клику на оверлей
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !item) return null;

  return ReactDOM.createPortal(
    <div className="custom-modal-overlay" onClick={handleOverlayClick}>
      <div className="custom-modal-content">
        <Button
          className="custom-modal-close"
          type="text"
          icon={<CloseOutlined />}
          onClick={onClose}
        />
        <img
          src={photoSrc}
          alt={item.title}
          className="custom-modal-image"
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/800x600?text=No+Image';
          }}
        />
      </div>
    </div>,
    document.body
  );
};

export default CatalogItemModalWindow;