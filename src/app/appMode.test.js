import { canUseApp, isDemo } from './appMode';
import { PATHS } from './paths';

describe('appMode', () => {
  test('isDemo считается из pathname, не константой модуля', () => {
    expect(isDemo(PATHS.home)).toBe(false);
    expect(isDemo(PATHS.tyres)).toBe(false);
    expect(isDemo(PATHS.demo)).toBe(true);
    expect(isDemo(PATHS.demoTyres)).toBe(true);
    expect(isDemo(PATHS.demoWheels)).toBe(true);
    expect(isDemo(PATHS.demoBasket)).toBe(true);
    expect(isDemo('/demo/x')).toBe(true);
  });

  test('без сессии app закрыт на / и /tyres, открыт на /demo*', () => {
    expect(canUseApp(false, PATHS.home)).toBe(false);
    expect(canUseApp(false, PATHS.tyres)).toBe(false);
    expect(canUseApp(false, PATHS.wheels)).toBe(false);
    expect(canUseApp(false, PATHS.basket)).toBe(false);
    expect(canUseApp(false, PATHS.demo)).toBe(true);
    expect(canUseApp(false, PATHS.demoTyres)).toBe(true);
  });

  test('сессия открывает staff app независимо от pathname', () => {
    expect(canUseApp(true, PATHS.home)).toBe(true);
    expect(canUseApp(true, PATHS.tyres)).toBe(true);
    expect(canUseApp(true, PATHS.demoTyres)).toBe(true);
  });
});
