import React, { useMemo, useState } from 'react';
import { Card, Divider, Flex, Image, Space, Tooltip, Typography } from 'antd';
import { TruckOutlined } from '@ant-design/icons';
import runflatIcon from '../../../icons/runflat.jpg';
import { resolvePhotoUrl } from '../../../utils/fetchSupplier';
import './CatalogItemCard.scss';

const { Meta } = Card;
const { Text } = Typography;

const isValidPrice = (value) => {
  if (value == null || value === '') return false;
  const num =
    typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(num) && num > 0;
};

const formatPriceDisplay = (value) => {
  if (!isValidPrice(value)) return '—';
  const num =
    typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return `${num.toLocaleString('ru-RU')} руб.`;
};

const DetailRow = ({ label, value, rowClassName = 'item-detail-row' }) => (
  <Flex className={rowClassName} justify="space-between" align="center">
    <Text className="detail-label">{label}</Text>
    <Text className="detail-value">{value}</Text>
  </Flex>
);

const CatalogItemCard = ({
  item,
  isClientMode = false,
  cardClassName = 'item-card',
  ModalComponent,
  modalItemPropName = 'item',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const supplierLabel = useMemo(
    () => (item?.supplier ? `Поставщик: ${item.supplier}` : null),
    [item?.supplier]
  );

  const photoSrc = useMemo(
    () => resolvePhotoUrl(item?.photoUrl, item?.supplier),
    [item?.photoUrl, item?.supplier]
  );

  const detailRows = useMemo(() => {
    if (!item) return [];

    if (isClientMode) {
      return [
        {
          key: 'selling',
          label: 'Цена:',
          value: formatPriceDisplay(item.sellingPrice ?? item.price),
        },
      ];
    }

    const rows = [
      { key: 'b2b', label: 'B2B:', value: item.price, show: isValidPrice(item.price) },
      {
        key: 'website',
        label: 'Интернет цена:',
        value: item.websitePrice,
        show: isValidPrice(item.websitePrice),
      },
      {
        key: 'selling',
        label: 'Цена:',
        value: item.sellingPrice ?? item.price,
        show: isValidPrice(item.sellingPrice) || isValidPrice(item.price),
      },
    ]
      .filter((row) => row.show)
      .map(({ show, value, ...row }) => ({
        ...row,
        value: formatPriceDisplay(value),
      }));

    if (item.supplier) {
      rows.push({
        key: 'supplier',
        label: 'Поставщик:',
        value: item.supplier,
      });
    }

    return rows;
  }, [item, isClientMode]);

  const handleImageClick = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  if (!item) return null;

  const modalProps = {
    isOpen: isModalOpen,
    onClose: handleCloseModal,
    isClientMode,
    [modalItemPropName]: item,
  };

  return (
    <>
      <Card
        className={cardClassName}
        hoverable
        cover={
          <Flex
            className="item-image-frame"
            align="center"
            justify="center"
            onClick={handleImageClick}
            style={{ position: 'relative' }}
          >
            <Image
              className="item-image"
              src={photoSrc}
              alt={item.title}
              fallback="https://via.placeholder.com/300x200?text=No+Image"
              preview={false}
              referrerPolicy="no-referrer"
            />
            {(item.code || item.runflat) ? (
              <Flex
                className="item-code-overlay"
                vertical
                gap={4}
                align="flex-start"
              >
                {item.code ? (
                  <Text className="item-code-text" ellipsis>
                    Код товара: {item.code}
                  </Text>
                ) : null}
                {item.runflat ? (
                  <Image
                    className="item-runflat-icon"
                    src={runflatIcon}
                    alt="Runflat"
                    preview={false}
                  />
                ) : null}
              </Flex>
            ) : null}
            <Flex className="item-image-overlays" />
          </Flex>
        }
      >
        <Meta
          title={
            <Flex className="item-title-wrapper" vertical>
              <Text
                className="item-title-text"
                ellipsis={{ tooltip: item.title }}
              >
                {item.title}
              </Text>
              {item.sizeTitle && (
                <Text className="item-size-text">{item.sizeTitle}</Text>
              )}
              {item.color ? (
                <Text className="item-color-text" type="secondary">
                  {item.color}
                </Text>
              ) : null}
            </Flex>
          }
          description={
            <Flex className="item-details" vertical>
              {detailRows.map((row) => (
                <React.Fragment key={row.key}>
                  <Divider className="item-detail-divider" />
                  <DetailRow label={row.label} value={row.value} />
                </React.Fragment>
              ))}
              <Divider className="item-detail-divider" />
              <Flex className="item-stock" justify="space-between" align="center">
                <Text className="detail-label">В наличии:</Text>
                <Space className="item-stock-space" size={8} align="center">
                  <Text className="stock-value">{item.amount} шт.</Text>
                  {isClientMode && supplierLabel && (
                    <Tooltip title={supplierLabel} placement="top">
                      <Text className="supplier-icon" aria-label={supplierLabel}>
                        <TruckOutlined />
                      </Text>
                    </Tooltip>
                  )}
                </Space>
              </Flex>
            </Flex>
          }
        />
      </Card>

      {ModalComponent ? <ModalComponent {...modalProps} /> : null}
    </>
  );
};

export default CatalogItemCard;