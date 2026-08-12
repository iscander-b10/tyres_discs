import React, { useMemo, useState } from 'react';
import { Card, Divider, Flex, Image, Typography } from 'antd';
import runflatIcon from '../../../icons/runflat.jpg';
import { ReactComponent as VanIcon } from '../../../icons/Van.svg';
import { resolvePhotoUrl } from '../../../utils/fetchSupplier';
import HoverTooltip from '../HoverTooltip';
import AddToCartControl from '../AddToCartControl/AddToCartControl';
import CatalogPriceStrip from '../CatalogPriceStrip/CatalogPriceStrip';
import './CatalogItemCard.scss';

const { Meta } = Card;
const { Text } = Typography;

const CatalogItemCard = ({
  item,
  isClientMode = false,
  cardClassName = 'item-card',
  ModalComponent,
  modalItemPropName = 'item',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const supplierName = item?.supplier || null;
  const supplierTooltip = useMemo(
    () => (supplierName ? `Поставщик: ${supplierName}` : null),
    [supplierName]
  );

  const photoSrc = useMemo(
    () => resolvePhotoUrl(item?.photoUrl, item?.supplier),
    [item?.photoUrl, item?.supplier]
  );

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
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleImageClick();
              }
            }}
            aria-label={`Открыть ${item.title}`}
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
                    Код: {item.code}
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
              <Divider className="item-detail-divider" />

              {!isClientMode && supplierName ? (
                <>
                  <Flex className="item-supplier" justify="space-between" align="center">
                    <Text className="detail-label">Поставщик:</Text>
                    <Text
                      className="stock-value supplier-name"
                      ellipsis={{ tooltip: supplierName }}
                    >
                      {supplierName}
                    </Text>
                  </Flex>
                  <Divider className="item-detail-divider" />
                </>
              ) : null}

              <Flex className="item-stock" justify="space-between" align="center">
                <Text className="detail-label">В наличии:</Text>
                <Flex className="item-stock__value-row" align="center" gap={8}>
                  <Text className="stock-value">{item.amount} шт.</Text>
                  {isClientMode && supplierName ? (
                    <HoverTooltip title={supplierTooltip} placement="top">
                      <span
                        className="supplier-icon"
                        aria-label={supplierTooltip}
                      >
                        <VanIcon className="supplier-icon__svg" />
                      </span>
                    </HoverTooltip>
                  ) : null}
                </Flex>
              </Flex>

              <Divider className="item-detail-divider" />

              <CatalogPriceStrip
                item={item}
                isClientMode={isClientMode}
                className="item-price-strip"
              />

              <AddToCartControl item={item} className="item-cart-control" />
            </Flex>
          }
        />
      </Card>

      {ModalComponent ? <ModalComponent {...modalProps} /> : null}
    </>
  );
};

export default CatalogItemCard;
