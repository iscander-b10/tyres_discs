import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveSlot,
  versionForPublication,
  versionForSlot,
} from './time.js';

test('повтор одного слота в один день даёт большую version', () => {
  const slot = '08:00';
  assert.equal(resolveSlot(slot), slot);

  const first = versionForPublication(new Date('2026-11-26T05:00:01.000Z'));
  const second = versionForPublication(new Date('2026-11-26T05:02:10.000Z'));

  assert.equal(first, '2026-11-26T08:00:01+03:00');
  assert.equal(second, '2026-11-26T08:02:10+03:00');
  assert.ok(second > first);
  assert.notEqual(first.slice(0, 16), second.slice(0, 16));

  const previousSlotVersion = versionForSlot(
    slot,
    new Date('2026-11-26T06:00:00.000Z')
  );
  assert.equal(previousSlotVersion, '2026-11-26T08:00:00+03:00');
  assert.ok(first > previousSlotVersion);
});
