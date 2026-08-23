jest.mock('./crypto', () => ({
  createAccountId: jest.fn(async () => 'account-hash'),
  normalizeLogin: (login) => String(login ?? '').trim().toLowerCase(),
}));

const { createAccountId } = require('./crypto');
const { createWorkspace, resolveStoreId } = require('./workspace');

describe('store resolver', () => {
  beforeEach(() => {
    createAccountId.mockResolvedValue('account-hash');
  });

  test('accountId имеет приоритет над normalized login', () => {
    expect(
      resolveStoreId({
        accountId: 'account-hash',
        login: ' User@Example.COM ',
        storeMap: JSON.stringify({
          'account-hash': 'account-store',
          'user@example.com': 'login-store',
        }),
        fallbackStoreId: 'fallback-store',
      })
    ).toBe('account-store');
  });

  test('использует normalized login при отсутствии accountId', () => {
    expect(
      resolveStoreId({
        accountId: 'unknown',
        login: ' User@Example.COM ',
        storeMap: '{"user@example.com":"login-store"}',
        fallbackStoreId: 'fallback-store',
      })
    ).toBe('login-store');
  });

  test.each(['', '{bad json', '[]', '{"other":"store"}'])(
    'использует single-store fallback для map %p',
    (storeMap) => {
      expect(
        resolveStoreId({
          accountId: 'unknown',
          login: 'unknown@example.com',
          storeMap,
          fallbackStoreId: ' fallback-store ',
        })
      ).toBe('fallback-store');
    }
  );

  test('атомарно формирует normalized workspace', async () => {
    await expect(
      createWorkspace(' User@Example.COM ', {
        storeMap: '{"account-hash":"account-store"}',
        fallbackStoreId: 'fallback-store',
      })
    ).resolves.toEqual({
      login: 'user@example.com',
      accountId: 'account-hash',
      storeId: 'account-store',
    });
  });
});
