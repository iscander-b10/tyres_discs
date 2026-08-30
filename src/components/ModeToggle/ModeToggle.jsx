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
const TOUCH_DRAG_THRESHOLD_PX = 12;
const LONG_PRESS_MS = 420;

const POINTER_MOVE_OPTIONS = { capture: true, passive: false };
const POINTER_UP_OPTIONS = { capture: true };

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

function isCoarsePointerType(pointerType) {
  return pointerType === 'touch' || pointerType === 'pen';
}

function clearHoldTimer(drag) {
  if (drag?.holdTimer == null) return;
  window.clearTimeout(drag.holdTimer);
  drag.holdTimer = null;
}

function trySetPointerCapture(target, pointerId) {
  if (!target?.setPointerCapture) return;
  try {
    if (!target.hasPointerCapture?.(pointerId)) {
      target.setPointerCapture(pointerId);
    }
  } catch {
    /* already released or unsupported */
  }
}

function tryReleasePointerCapture(target, pointerId) {
  if (!target?.hasPointerCapture?.(pointerId)) return;
  try {
    target.releasePointerCapture(pointerId);
  } catch {
    /* already released */
  }
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

  const detachDragListeners = useCallback((drag) => {
    if (!drag) return;
    window.removeEventListener(
      'pointermove',
      drag.onPointerMove,
      POINTER_MOVE_OPTIONS,
    );
    window.removeEventListener('pointerup', drag.onPointerUp, POINTER_UP_OPTIONS);
    window.removeEventListener(
      'pointercancel',
      drag.onPointerUp,
      POINTER_UP_OPTIONS,
    );
    window.removeEventListener(
      'touchmove',
      drag.onTouchMove,
      POINTER_MOVE_OPTIONS,
    );
  }, []);

  useEffect(() => {
    const panelEl = panelRef.current;

    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }

      const drag = dragRef.current;
      if (!drag) return;

      clearHoldTimer(drag);
      detachDragListeners(drag);
      dragRef.current = null;
      panelEl?.classList.remove('is-dragging');
    };
  }, [detachDragListeners]);

  const beginDrag = useCallback(
    (dx, dy) => {
      const drag = dragRef.current;
      if (!drag || drag.moved) return;

      clearHoldTimer(drag);
      trySetPointerCapture(drag.captureTarget, drag.pointerId);

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
    },
    [writeDragOffset],
  );

  const endDrag = useCallback(
    (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      clearHoldTimer(drag);

      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        flushPendingPosition();
      }

      tryReleasePointerCapture(drag.captureTarget, event.pointerId);
      detachDragListeners(drag);

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
    [
      clearDragTransform,
      detachDragListeners,
      flushPendingPosition,
      writeRestingPosition,
    ],
  );

  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!positionRef.current) return;

    const fromInteractive = isInteractiveTarget(event.target);
    const coarse = isCoarsePointerType(event.pointerType);

    // Mouse click on the switch must still toggle; drag from the chrome around it.
    if (fromInteractive && !coarse) return;

    const { width, height } = measureSize();
    if (!width || !height) return;

    const onPointerMove = (moveEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== moveEvent.pointerId) return;

      const dx = moveEvent.clientX - drag.startX;
      const dy = moveEvent.clientY - drag.startY;
      drag.lastDx = dx;
      drag.lastDy = dy;

      if ((drag.moved || drag.holdTimer != null) && moveEvent.cancelable) {
        moveEvent.preventDefault();
      }

      if (!drag.moved) {
        const threshold =
          drag.fromInteractive && drag.coarse
            ? TOUCH_DRAG_THRESHOLD_PX
            : DRAG_THRESHOLD_PX;
        if (Math.hypot(dx, dy) < threshold) return;
        beginDrag(dx, dy);
        return;
      }

      scheduleDomPosition(
        drag.originLeft + dx,
        drag.originTop + dy,
        drag.width,
        drag.height,
      );
    };

    const onTouchMove = (touchEvent) => {
      const drag = dragRef.current;
      if (!drag?.moved || !touchEvent.cancelable) return;
      touchEvent.preventDefault();
    };

    const onPointerUp = (upEvent) => {
      endDrag(upEvent);
    };

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastDx: 0,
      lastDy: 0,
      originLeft: positionRef.current.left,
      originTop: positionRef.current.top,
      width,
      height,
      moved: false,
      fromInteractive,
      coarse,
      holdTimer: null,
      captureTarget: event.currentTarget,
      onPointerMove,
      onTouchMove,
      onPointerUp,
    };

    // Capture immediately only when the gesture cannot be a switch tap.
    // Delayed capture lets a short touch still toggle the switch.
    if (!fromInteractive) {
      trySetPointerCapture(event.currentTarget, event.pointerId);
    }

    if (coarse) {
      dragRef.current.holdTimer = window.setTimeout(() => {
        const drag = dragRef.current;
        if (!drag || drag.moved) return;
        beginDrag(drag.lastDx, drag.lastDy);
        try {
          navigator.vibrate?.(10);
        } catch {
          /* ignore */
        }
      }, LONG_PRESS_MS);
    }

    window.addEventListener('pointermove', onPointerMove, POINTER_MOVE_OPTIONS);
    window.addEventListener('pointerup', onPointerUp, POINTER_UP_OPTIONS);
    window.addEventListener('pointercancel', onPointerUp, POINTER_UP_OPTIONS);
    window.addEventListener('touchmove', onTouchMove, POINTER_MOVE_OPTIONS);
  };

  const onContextMenu = (event) => {
    event.preventDefault();
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
        onContextMenu={onContextMenu}
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
