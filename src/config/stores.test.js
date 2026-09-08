import { DEMO_STORE_ID } from '../app/demoWorkspace';
import {
  DEFAULT_STORE_PROFILE_ID,
  STORE_PROFILES,
  getStoreProfile,
} from './stores';

describe('getStoreProfile', () => {
  test('возвращает профиль ElistaIvanor', () => {
    const profile = getStoreProfile('ElistaIvanor');
    expect(profile).toBe(STORE_PROFILES.ElistaIvanor);
    expect(profile.displayName).toBe('Ivanor');
    expect(profile.phone).toEqual({
      display: '8 937 192-09-59',
      href: 'tel:+79371920959',
    });
    expect(profile.pricing.tyreMargins).toEqual({
      russian: 15,
      import: 23,
      default: 18,
    });
    expect(profile.pricing.discMargin).toBe(20);
  });

  test('demo не мапится на Иванор', () => {
    expect(getStoreProfile(DEMO_STORE_ID)).toBeNull();
    expect(getStoreProfile('demo')).toBeNull();
  });

  test('неизвестный storeId падает на ElistaIvanor', () => {
    expect(getStoreProfile('UnknownTenant')).toBe(
      STORE_PROFILES[DEFAULT_STORE_PROFILE_ID]
    );
    expect(getStoreProfile('')).toBe(STORE_PROFILES.ElistaIvanor);
    expect(getStoreProfile(undefined)).toBe(STORE_PROFILES.ElistaIvanor);
  });
});
