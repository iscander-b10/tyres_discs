import {
  hashSeed,
  resolveShowcaseSeed,
  shuffleItems,
} from './showcaseSeed';

describe('showcaseSeed', () => {
  test('один seed → одна перестановка; другой seed → другая', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id }));
    const a = shuffleItems(items, 'seed-a');
    const b = shuffleItems(items, 'seed-a');
    const c = shuffleItems(items, 'seed-b');
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
    expect(c.map((i) => i.id)).not.toEqual(a.map((i) => i.id));
    expect([...c.map((i) => i.id)].sort()).toEqual(
      [...a.map((i) => i.id)].sort()
    );
  });

  test('resolveShowcaseSeed: version снимка; пустая → fallback от ids', () => {
    expect(
      resolveShowcaseSeed({
        catalogSnapshotVersion: '2026-08-24T12:10:00Z',
        workspaceResetKey: 'ws-1',
        candidates: [{ id: 1 }, { id: 2 }],
      })
    ).toBe('ws-1|snap:2026-08-24T12:10:00Z');

    const fallbackA = resolveShowcaseSeed({
      catalogSnapshotVersion: '',
      workspaceResetKey: 'ws-1',
      candidates: [{ id: 'a' }, { id: 'b' }],
    });
    const fallbackB = resolveShowcaseSeed({
      catalogSnapshotVersion: '',
      workspaceResetKey: 'ws-1',
      candidates: [{ id: 'a' }, { id: 'b' }],
    });
    const fallbackC = resolveShowcaseSeed({
      catalogSnapshotVersion: '',
      workspaceResetKey: 'ws-1',
      candidates: [{ id: 'a' }, { id: 'c' }],
    });
    expect(fallbackA).toBe(fallbackB);
    expect(fallbackA).toMatch(/^ws-1\|data:/);
    expect(fallbackC).not.toBe(fallbackA);
    expect(fallbackA).not.toContain('snap:');
  });

  test('hashSeed стабилен', () => {
    expect(hashSeed('x')).toBe(hashSeed('x'));
    expect(hashSeed('x')).not.toBe(hashSeed('y'));
  });
});
