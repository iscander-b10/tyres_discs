import React, { useEffect, useRef, useState } from 'react';
import { Empty } from 'antd';
import { useAppShell } from '../../../app/AppShellContext';
import {
  getCatalogShowcase,
  SHOWCASE_CONFIG,
} from '../../../catalog/showcase';
import ShowcaseShelf from './ShowcaseShelf';
import ShowcaseSizeChips from './ShowcaseSizeChips';
import { getShowcaseStaticChips } from './showcaseChips';
import './CatalogShowcase.scss';

/**
 * Автовитрина каталога (idle / сброс фильтров).
 * Шины: хиты сезона + чипы размеров.
 * Диски: популярные модели + чипы диаметров.
 */
const CatalogShowcase = ({
  kind = 'tires',
  renderCard,
  onChipClick,
}) => {
  const { clientMode: isClientMode, catalogDataVersion = 0 } = useAppShell();
  const [status, setStatus] = useState('loading');
  const [showcase, setShowcase] = useState(null);
  const requestIdRef = useRef(0);
  const staticChips = getShowcaseStaticChips(kind);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setStatus('loading');

    getCatalogShowcase({
      kind,
      catalogDataVersion,
    })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setShowcase(result);
        setStatus('ready');
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setShowcase(null);
        setStatus('error');
      });
  }, [kind, catalogDataVersion]);

  const chips = showcase?.chips ?? staticChips.chips;
  const chipsTitle = showcase?.chipsTitle ?? staticChips.chipsTitle;
  const shelves = showcase?.shelves ?? [];
  const skeletonTitle =
    kind === 'discs'
      ? SHOWCASE_CONFIG.copy.popularModels
      : SHOWCASE_CONFIG.copy.seasonHits;

  if (status === 'error') {
    return (
      <div className="catalog-showcase catalog-showcase--empty" role="status">
        <Empty description="Не удалось собрать витрину. Попробуйте обновить данные каталога." />
      </div>
    );
  }

  if (status === 'ready' && showcase?.empty) {
    return (
      <div className="catalog-showcase catalog-showcase--empty" role="status">
        <Empty
          description={
            <div className="catalog-showcase__empty-copy">
              <p className="catalog-showcase__empty-title">
                {SHOWCASE_CONFIG.copy.catalogEmptyTitle}
              </p>
              <p className="catalog-showcase__empty-hint">
                {SHOWCASE_CONFIG.copy.catalogEmptyHint}
              </p>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div
      className={`catalog-showcase${status === 'loading' ? ' catalog-showcase--loading' : ''}`}
      aria-busy={status === 'loading' || undefined}
    >
      {status === 'loading' ? (
        <ShowcaseShelf
          title={skeletonTitle}
          skeleton
          skeletonCount={6}
        />
      ) : (
        shelves.map((shelf) => (
          <ShowcaseShelf
            key={shelf.id}
            title={shelf.title}
            items={shelf.items}
            renderCard={renderCard}
            isClientMode={isClientMode}
          />
        ))
      )}

      <ShowcaseSizeChips
        title={chipsTitle}
        chips={chips}
        kind={kind}
        onChipClick={onChipClick}
        ariaLabel={chipsTitle}
      />
    </div>
  );
};

export default CatalogShowcase;
