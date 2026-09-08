import {
  durationFor,
  innerCanConsume,
  isTypingTarget,
  slideIndexFromOffsets,
  syncSlideOverflow,
} from './landingSnap';

describe('landingSnap', () => {
  test('slideIndexFromOffsets picks the nearest snap', () => {
    expect(slideIndexFromOffsets(0, [0, 800, 1600])).toBe(0);
    expect(slideIndexFromOffsets(390, [0, 800, 1600])).toBe(0);
    expect(slideIndexFromOffsets(410, [0, 800, 1600])).toBe(1);
    expect(slideIndexFromOffsets(2000, [0, 800, 1600])).toBe(2);
  });

  test('slideIndexFromOffsets is 0 when there are no slides', () => {
    expect(slideIndexFromOffsets(120, [])).toBe(0);
  });

  test('durationFor grows with skipped slides and caps', () => {
    expect(durationFor(0, 1)).toBe(720);
    expect(durationFor(0, 3)).toBe(860);
    expect(durationFor(0, 20)).toBe(1400);
  });

  test('innerCanConsume only for overflow slides that can still move', () => {
    const slide = {
      classList: { contains: (name) => name === 'is-overflow' },
      scrollHeight: 1200,
      clientHeight: 800,
      scrollTop: 0,
    };
    expect(innerCanConsume(slide, 10)).toBe(true);
    expect(innerCanConsume(slide, -10)).toBe(false);
    slide.scrollTop = 400;
    expect(innerCanConsume(slide, -10)).toBe(true);
    expect(innerCanConsume(null, 10)).toBe(false);
  });

  test('syncSlideOverflow marks slides taller than the viewport', () => {
    const short = {
      scrollHeight: 800,
      clientHeight: 800,
      classList: { toggle: jest.fn() },
    };
    const tall = {
      scrollHeight: 1200,
      clientHeight: 800,
      classList: { toggle: jest.fn() },
    };
    syncSlideOverflow([short, tall]);
    expect(short.classList.toggle).toHaveBeenCalledWith('is-overflow', false);
    expect(tall.classList.toggle).toHaveBeenCalledWith('is-overflow', true);
  });

  test('isTypingTarget ignores buttons and detects inputs', () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget({ tagName: 'BUTTON', isContentEditable: false })).toBe(
      false
    );
    expect(isTypingTarget({ tagName: 'INPUT', isContentEditable: false })).toBe(
      true
    );
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(
      true
    );
  });
});
