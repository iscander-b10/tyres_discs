import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { Flex, Switch } from 'antd';
import { useAppShell } from '../../app/AppShellContext';
import HoverTooltip from '../shared/HoverTooltip';
import './ModeToggle.scss';

const POSITION_STORAGE_KEY = 'ivanor.mode-toggle.position';
const LEGACY_POSITION_STORAGE_KEY = 'ivanor-sidebar-position';
const EDGE_MARGIN = 0;
const DRAG_THRESHOLD_PX = 5;

const INTERACTIVE_SELECTOR =
  '.ant-switch, button, a, input, textarea, select, [data-no-drag]';

function clampPosition(left, top, width, height) {
  const maxLeft = Math.max(EDGE_MARGIN, window.innerWidth - width - EDGE_MARGIN);
  const maxTop = Math.max(EDGE_MARGIN, window.innerHeight - height - EDGE_MARGIN);

  return {
    left: Math.min(Math.max(EDGE_MARGIN, left), maxLeft),
    top: Math.min(Math.max(EDGE_MARGIN, top), maxTop),
  };
}

function getDefaultPosition(width, height) {
  return clampPosition(
    EDGE_MARGIN,
    window.innerHeight - height - EDGE_MARGIN,
    width,
    height,
  );
}

function toRatios(left, top, width, height) {
  const availW = Math.max(1, window.innerWidth - width - EDGE_MARGIN * 2);
  const availH = Math.max(1, window.innerHeight - height - EDGE_MARGIN * 2);

  return {
    left,
    top,
    leftRatio: (left - EDGE_MARGIN) / availW,
    topRatio: (top - EDGE_MARGIN) / availH,
  };
}

function fromStored(parsed, width, height) {
  if (
    typeof parsed?.leftRatio === 'number' &&
    Number.isFinite(parsed.leftRatio) &&
    typeof parsed?.topRatio === 'number' &&
    Number.isFinite(parsed.topRatio)
  ) {
    const availW = Math.max(1, window.innerWidth - width - EDGE_MARGIN * 2);
    const availH = Math.max(1, window.innerHeight - height - EDGE_MARGIN * 2);

    return clampPosition(
      EDGE_MARGIN + parsed.leftRatio * availW,
      EDGE_MARGIN + parsed.topRatio * availH,
      width,
      height,
    );
  }

  if (
    typeof parsed?.left === 'number' &&
    Number.isFinite(parsed.left) &&
    typeof parsed?.top === 'number' &&
    Number.isFinite(parsed.top)
  ) {
    return clampPosition(parsed.left, parsed.top, width, height);
  }

  return null;
}

function loadStoredPosition(width, height) {
  try {
    const raw =
      window.localStorage.getItem(POSITION_STORAGE_KEY) ||
      window.localStorage.getItem(LEGACY_POSITION_STORAGE_KEY);
    if (!raw) return null;
    return fromStored(JSON.parse(raw), width, height);
  } catch {
    return null;
  }
}

function savePosition(left, top, width, height) {
  try {
    window.localStorage.setItem(
      POSITION_STORAGE_KEY,
      JSON.stringify(toRatios(left, top, width, height)),
    );
    window.localStorage.removeItem(LEGACY_POSITION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function isInteractiveTarget(target) {
  return Boolean(target?.closest?.(INTERACTIVE_SELECTOR));
}

function ModeToggle() {
  const { clientMode, setClientMode } = useAppShell();
  const panelRef = useRef(null);
  const controlsRef = useRef(null);
  const positionRef = useRef(null);
  const dragRef = useRef(null);
  const rafRef = useRef(null);
  const pendingPosRef = useRef(null);
  const suppressClickRef = useRef(false);

  const [position, setPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  const measureSize = useCallback(() => {
    const el = controlsRef.current;
    if (!el) return { width: 0, height: 0 };
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, []);

  const clearDragTransform = useCallback(() => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transform = '';
    el.style.willChange = '';
  }, []);

  const writeRestingPosition = useCallback((left, top) => {
    const el = panelRef.current;
    if (!el) return;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.transform = '';
  }, []);

  const writeDragOffset = useCallback((left, top, originLeft, originTop) => {
    const el = panelRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${left - originLeft}px, ${top - originTop}px, 0)`;
  }, []);

  const flushPendingPosition = useCallback(() => {
    rafRef.current = null;
    const pending = pendingPosRef.current;
    if (!pending) return;
    pendingPosRef.current = null;

    positionRef.current = pending;

    const drag = dragRef.current;
    if (drag?.moved) {
      writeDragOffset(pending.left, pending.top, drag.originLeft, drag.originTop);
    } else {
      writeRestingPosition(pending.left, pending.top);
    }
  }, [writeDragOffset, writeRestingPosition]);

  const scheduleDomPosition = useCallback(
    (left, top, width, height) => {
      pendingPosRef.current = clampPosition(left, top, width, height);
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(flushPendingPosition);
    },
    [flushPendingPosition],
  );

  const commitPosition = useCallback(
    (left, top, { snap = false } = {}) => {
      const { width, height } = measureSize();
      if (!width || !height) return null;

      const next = clampPosition(left, top, width, height);
      positionRef.current = next;
      writeRestingPosition(next.left, next.top);
      setPosition(next);

      if (snap) {
        setIsSnapping(true);
      }

      return { ...next, width, height };
    },
    [measureSize, writeRestingPosition],
  );

  useLayoutEffect(() => {
    const { width, height } = measureSize();
    if (!width || !height) return;

    const initial = loadStoredPosition(width, height) ?? getDefaultPosition(width, height);
    positionRef.current = initial;
    writeRestingPosition(initial.left, initial.top);
    setPosition(initial);
  }, [measureSize, writeRestingPosition]);

  useLayoutEffect(() => {
    if (!isDragging) return;
    const drag = dragRef.current;
    const current = pendingPosRef.current ?? positionRef.current;
    if (!drag?.moved || !current) return;
    writeDragOffset(current.left, current.top, drag.originLeft, drag.originTop);
  }, [isDragging, writeDragOffset]);

  useEffect(() => {
    const onResize = () => {
      const current = positionRef.current;
      if (!current) return;
      commitPosition(current.left, current.top, { snap: true });
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [commitPosition]);

  useEffect(() => {
    if (!isSnapping) return undefined;
    const id = window.setTimeout(() => setIsSnapping(false), 180);
    return () => window.clearTimeout(id);
  }, [isSnapping, position]);

  useEffect(() => {
    const panelEl = panelRef.current;

    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }

      const drag = dragRef.current;
      if (!drag) return;

      window.removeEventListener('pointermove', drag.onPointerMove);
      window.removeEventListener('pointerup', drag.onPointerUp);
      window.removeEventListener('pointercancel', drag.onPointerUp);
      dragRef.current = null;
      panelEl?.classList.remove('is-dragging');
    };
  }, []);

  const endDrag = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        flushPendingPosition();
      }

      const captureTarget = drag.captureTarget;
      if (captureTarget?.hasPointerCapture?.(event.pointerId)) {
        captureTarget.releasePointerCapture(event.pointerId);
      }

      window.removeEventListener('pointermove', drag.onPointerMove);
      window.removeEventListener('pointerup', drag.onPointerUp);
      window.removeEventListener('pointercancel', drag.onPointerUp);

      const current = positionRef.current;
      if (drag.moved && current) {
        suppressClickRef.current = true;
        clearDragTransform();
        writeRestingPosition(current.left, current.top);
        setPosition(current);
        savePosition(current.left, current.top, drag.width, drag.height);
      }

      setIsDragging(false);
      dragRef.current = null;
    },
    [clearDragTransform, flushPendingPosition, writeRestingPosition],
  );

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (isInteractiveTarget(event.target)) return;
    if (!positionRef.current) return;

    const { width, height } = measureSize();
    if (!width || !height) return;

    const onPointerMove = (moveEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== moveEvent.pointerId) return;

      const dx = moveEvent.clientX - drag.startX;
      const dy = moveEvent.clientY - drag.startY;

      if (!drag.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        const el = panelRef.current;
        if (el) {
          el.style.willChange = 'transform';
        }
        const next = clampPosition(
          drag.originLeft + dx,
          drag.originTop + dy,
          drag.width,
          drag.height,
        );
        pendingPosRef.current = next;
        positionRef.current = next;
        writeDragOffset(next.left, next.top, drag.originLeft, drag.originTop);
        setIsDragging(true);
        setIsSnapping(false);
        return;
      }

      scheduleDomPosition(
        drag.originLeft + dx,
        drag.originTop + dy,
        drag.width,
        drag.height,
      );
    };

    const onPointerUp = (upEvent) => {
      endDrag(upEvent);
    };

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: positionRef.current.left,
      originTop: positionRef.current.top,
      width,
      height,
      moved: false,
      captureTarget: event.currentTarget,
      onPointerMove,
      onPointerUp,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const onClickCapture = (event) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const targetModeLabel = clientMode ? 'Режим менеджера' : 'Режим клиента';
  const switchAriaLabel = clientMode
    ? 'Переключить на режим менеджера'
    : 'Переключить на режим клиента';

  const panelClassName = [
    'floating-mode-toggle',
    isDragging ? 'is-dragging' : '',
    isSnapping ? 'is-snapping' : '',
    position ? 'is-positioned' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return ReactDOM.createPortal(
    <aside
      ref={panelRef}
      className={panelClassName}
      aria-label="Переключение режима клиента и менеджера"
      style={
        position
          ? { left: position.left, top: position.top }
          : undefined
      }
    >
      <Flex
        ref={controlsRef}
        className="mode-toggle-controls"
        align="center"
        gap={8}
        onPointerDown={onPointerDown}
        onClickCapture={onClickCapture}
      >
        <HoverTooltip title={targetModeLabel} placement="top">
          <Switch
            className="client-mode-switch"
            checked={clientMode}
            onChange={setClientMode}
            aria-label={switchAriaLabel}
            data-no-drag
          />
        </HoverTooltip>
      </Flex>
    </aside>,
    document.body,
  );
}

export default ModeToggle;
