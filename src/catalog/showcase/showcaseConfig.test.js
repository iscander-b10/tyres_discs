import { DEMO_STORE_ID } from '../../app/demoWorkspace';
import { SHOWCASE_CONFIG, getShowcaseSupplier } from './showcaseConfig';

describe('getShowcaseSupplier', () => {
  test('live store использует production label', () => {
    expect(getShowcaseSupplier('ElistaIvanor')).toBe(
      SHOWCASE_CONFIG.showcaseSupplier
    );
    expect(getShowcaseSupplier(undefined)).toBe(
      SHOWCASE_CONFIG.showcaseSupplier
    );
  });

  test('demo workspace использует анонимизированный label', () => {
    expect(getShowcaseSupplier(DEMO_STORE_ID)).toBe(
      SHOWCASE_CONFIG.showcaseSupplierDemo
    );
  });
});
