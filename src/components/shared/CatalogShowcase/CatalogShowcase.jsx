import React, { useEffect, useRef, useState } from 'react';
import { Empty } from 'antd';
import { useAppShell } from '../../../app/AppShellContext';
import {
  getCatalogShowcase,
  SHOWCASE_CONFIG,
} from '../../../catalog/showcase';
import {
  appLog,
  isExpectedOperationalError,
} from '../../../utils/appLog';
import ShowcaseShelf from './ShowcaseShelf';
import ShowcaseSizeChips from './ShowcaseSizeChips';
import { getShowcaseStaticChips } from './showcaseChips';
import './CatalogShowcase.scss';

/**
 * Автовитрина каталога (idle / сброс фильтров).
 * Шины: полка сезона + чипы размеров.
 * Диски: литые в наличии + чипы диаметров.
 */
const CatalogShowcase = ({
  kind = 'tires',
  renderCard,
  onChipClick,
}) => {
  const {
    clientMode: isClientMode,
    catalogDataVersion = 0,
    catalogSnapshotVersion = '',
    workspaceResetKey = 'guest',
  } = useAppShell();
  const [status, setStatus] = useState('loading');
  const [showcase, setShowcase] = useState(null);
  const requestIdRef = useRef(0);
  const showcaseRef = useRef(showcase);
  showcaseRef.current = showcase;
  const staticChips = getShowcaseStaticChips(kind);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const hasStaleShowcase = showcaseRef.current !== null;
    if (!hasStaleShowcase) {
      setStatus('loading');
    }

    getCatalogShowcase({
      kind,
      catalogDataVersion,
      catalogSnapshotVersion,
      workspaceResetKey,
    })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setShowcase(result);
        setStatus('ready');
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) return;
        if (!isExpectedOperationalError(error)) {
          appLog.error({
            code: 'showcase.load_failed',
            domain: 'showcase',
            message: 'Catalog showcase load failed',
            error,
            context: {
              kind,
              catalogDataVersion,
              catalogSnapshotVersion,
              workspaceResetKey,
              hadStale: hasStaleShowcase,
            },
          });
        }
        if (!hasStaleShowcase) {
          setShowcase(null);
          setStatus('error');
        }
      });
  }, [kind, catalogDataVersion, catalogSnapshotVersion, workspaceResetKey]);

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
        <Empty description="Не удалось собрать полки. Загрузите данные ещё раз." />
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
          variant="featured"
        />
      ) : (
        shelves.map((shelf) => (
          <ShowcaseShelf
            key={shelf.id}
            title={shelf.title}
            items={shelf.items}
            renderCard={renderCard}
            isClientMode={isClientMode}
            variant="featured"
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
