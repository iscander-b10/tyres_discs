import {
  labelFromSyncProgress,
  formatCatalogBytesLabel,
  CATALOG_BOOTSTRAP_LOADING_LABEL,
} from './catalogBootstrap';

describe('labelFromSyncProgress', () => {
  test('без total показывает МБ', () => {
    expect(
      labelFromSyncProgress({ phase: 'download', receivedBytes: 2_400_000 })
    ).toBe(formatCatalogBytesLabel(2_400_000));
  });

  test('hideBytesLabel не показывает размер файла даже без total', () => {
    expect(
      labelFromSyncProgress(
        { phase: 'download', receivedBytes: 12_000_000 },
        CATALOG_BOOTSTRAP_LOADING_LABEL,
        { hideBytesLabel: true }
      )
    ).toBe(CATALOG_BOOTSTRAP_LOADING_LABEL);
  });

  test('с известным total показывает фазу, не МБ', () => {
    expect(
      labelFromSyncProgress({
        phase: 'download',
        receivedBytes: 12_000_000,
        totalBytes: 48_000_000,
      })
    ).toBe(CATALOG_BOOTSTRAP_LOADING_LABEL);
  });
});
