import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { LegacyCartMigrationModal } from './LegacyCartMigrationModal';
import { LEGACY_CART_KEYS } from './legacyCartMigration';

const legacyItems = [{ key: 'tyres:1', quantity: 2 }];

async function mountModal(props = {}) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onMigrated = jest.fn();
  await act(async () => {
    root.render(
      <LegacyCartMigrationModal
        accountId="account"
        generation={1}
        isCurrent={() => true}
        onMigrated={onMigrated}
        {...props}
      />
    );
  });
  return {
    onMigrated,
    async click(label) {
      const button = [...document.body.querySelectorAll('button')].find(
        (candidate) => candidate.textContent.trim() === label
      );
      expect(button).toBeTruthy();
      await act(async () => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    },
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe('LegacyCartMigrationModal', () => {
  beforeEach(() => localStorage.clear());

  test('показывает явные действия и переносит только после подтверждения', async () => {
    localStorage.setItem(
      LEGACY_CART_KEYS[0],
      JSON.stringify({ version: 2, items: legacyItems })
    );
    const harness = await mountModal();
    expect(document.body.textContent).toContain('Найдена старая корзина');
    expect(document.body.textContent).toContain('Перенести');
    expect(document.body.textContent).toContain('Удалить');
    expect(harness.onMigrated).not.toHaveBeenCalled();

    await harness.click('Перенести');
    expect(harness.onMigrated).toHaveBeenCalledWith(
      expect.objectContaining({ version: 3, items: legacyItems })
    );
    expect(localStorage.getItem(LEGACY_CART_KEYS[0])).toBeNull();
    await harness.unmount();
  });

  test('повреждённые данные объясняет безопасно и блокирует перенос', async () => {
    localStorage.setItem(LEGACY_CART_KEYS[0], '{broken');
    const harness = await mountModal();
    expect(document.body.textContent).toContain(
      'Данные старой корзины повреждены'
    );
    const migrateButton = [...document.body.querySelectorAll('button')].find(
      (candidate) => candidate.textContent.trim() === 'Перенести'
    );
    expect(migrateButton.disabled).toBe(true);

    await harness.click('Удалить');
    expect(localStorage.getItem(LEGACY_CART_KEYS[0])).toBeNull();
    expect(harness.onMigrated).not.toHaveBeenCalled();
    await harness.unmount();
  });
});
