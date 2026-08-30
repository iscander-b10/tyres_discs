import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useAppShell } from '../../app/AppShellContext';
import ModeToggle from './ModeToggle';

jest.mock('../../app/AppShellContext', () => ({ useAppShell: jest.fn() }));
jest.mock('../shared/HoverTooltip', () => ({ children }) => children);

if (typeof window.PointerEvent !== 'function') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
      this.pointerType = params.pointerType ?? '';
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  window.PointerEvent = PointerEventPolyfill;
}

const POSITION_STORAGE_KEY = 'ivanor.mode-toggle.position';
const PANEL_SIZE = { width: 70, height: 40 };

function pointerInit(overrides = {}) {
  return {
    pointerId: 1,
    pointerType: 'touch',
    button: 0,
    clientX: 20,
    clientY: 790,
    ...overrides,
  };
}

describe('ModeToggle drag', () => {
  let setClientMode;

  beforeEach(() => {
    setClientMode = jest.fn();
    useAppShell.mockReturnValue({
      clientMode: false,
      setClientMode,
    });
    window.localStorage.clear();
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 375,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 812,
    });
    jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        width: PANEL_SIZE.width,
        height: PANEL_SIZE.height,
        top: 772,
        left: 0,
        right: PANEL_SIZE.width,
        bottom: 812,
        x: 0,
        y: 772,
        toJSON: () => ({}),
      });
    HTMLElement.prototype.setPointerCapture = jest.fn();
    HTMLElement.prototype.releasePointerCapture = jest.fn();
    HTMLElement.prototype.hasPointerCapture = jest.fn(() => false);
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  const panel = () =>
    screen.getByRole('complementary', {
      name: 'Переключение режима клиента и менеджера',
    });

  const controls = () => document.querySelector('.mode-toggle-controls');
  const modeSwitch = () => screen.getByRole('switch');

  test('touch long-press на Switch поднимает панель без переключения режима', async () => {
    jest.useFakeTimers();
    render(<ModeToggle />);

    fireEvent.pointerDown(modeSwitch(), pointerInit());
    expect(panel()).not.toHaveClass('is-dragging');

    await act(async () => {
      jest.advanceTimersByTime(420);
    });

    expect(panel()).toHaveClass('is-dragging');
    expect(setClientMode).not.toHaveBeenCalled();

    fireEvent.pointerMove(
      window,
      pointerInit({ clientX: 180, clientY: 420 }),
    );
    fireEvent.pointerUp(window, pointerInit({ clientX: 180, clientY: 420 }));

    expect(panel()).not.toHaveClass('is-dragging');
    expect(panel().style.left).not.toBe('0px');
    expect(window.localStorage.getItem(POSITION_STORAGE_KEY)).toBeTruthy();
    expect(setClientMode).not.toHaveBeenCalled();
  });

  test('touch slide по Switch дальше порога начинает drag', () => {
    render(<ModeToggle />);

    fireEvent.pointerDown(modeSwitch(), pointerInit());
    fireEvent.pointerMove(
      window,
      pointerInit({ clientX: 20 + 20, clientY: 790 }),
    );

    expect(panel()).toHaveClass('is-dragging');

    fireEvent.pointerUp(window, pointerInit({ clientX: 40, clientY: 790 }));
    fireEvent.click(modeSwitch());

    expect(setClientMode).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(POSITION_STORAGE_KEY)).toBeTruthy();
  });

  test('короткий touch-tap по Switch переключает режим и не двигает панель', () => {
    render(<ModeToggle />);
    const startLeft = panel().style.left;

    fireEvent.pointerDown(modeSwitch(), pointerInit());
    fireEvent.pointerUp(window, pointerInit());
    fireEvent.click(modeSwitch());

    expect(setClientMode).toHaveBeenCalled();
    expect(panel()).not.toHaveClass('is-dragging');
    expect(panel().style.left).toBe(startLeft);
    expect(window.localStorage.getItem(POSITION_STORAGE_KEY)).toBeNull();
  });

  test('mouse drag с рамки панели двигает её, клик по Switch не начинает drag', () => {
    render(<ModeToggle />);

    fireEvent.pointerDown(
      modeSwitch(),
      pointerInit({ pointerType: 'mouse' }),
    );
    fireEvent.pointerMove(
      window,
      pointerInit({ pointerType: 'mouse', clientX: 80, clientY: 790 }),
    );
    expect(panel()).not.toHaveClass('is-dragging');

    fireEvent.pointerDown(
      controls(),
      pointerInit({ pointerType: 'mouse' }),
    );
    fireEvent.pointerMove(
      window,
      pointerInit({ pointerType: 'mouse', clientX: 80, clientY: 790 }),
    );
    expect(panel()).toHaveClass('is-dragging');

    fireEvent.pointerUp(
      window,
      pointerInit({ pointerType: 'mouse', clientX: 80, clientY: 790 }),
    );
    expect(window.localStorage.getItem(POSITION_STORAGE_KEY)).toBeTruthy();
  });
});
