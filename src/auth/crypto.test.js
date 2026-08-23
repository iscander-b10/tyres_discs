const { TextDecoder, TextEncoder } = require('util');
const { webcrypto } = require('crypto');

describe('auth crypto identity', () => {
  let createAccountId;
  let normalizeLogin;

  beforeAll(() => {
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
    Object.defineProperty(global, 'crypto', {
      configurable: true,
      value: webcrypto,
    });
    ({ createAccountId, normalizeLogin } = require('./crypto'));
  });

  test.each([
    [' User@Example.COM ', 'user@example.com'],
    ['', ''],
    [null, ''],
    [123, '123'],
  ])('normalizeLogin(%p) возвращает %p', (input, expected) => {
    expect(normalizeLogin(input)).toBe(expected);
  });

  test('accountId — стабильный SHA-256 от normalized login', async () => {
    const expected =
      'b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514';

    await expect(createAccountId(' User@Example.COM ')).resolves.toBe(expected);
    await expect(createAccountId('user@example.com')).resolves.toBe(expected);
  });
});
