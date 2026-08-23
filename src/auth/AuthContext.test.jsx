import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider, useAuth } from './AuthContext';
import { createWorkspace } from './workspace';
import { login, logout, restore } from './session';

jest.mock('./session', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  restore: jest.fn(),
}));

jest.mock('./workspace', () => ({
  createWorkspace: jest.fn(async (loginName) => ({
    login: loginName,
    accountId: `account:${loginName}`,
    storeId: `store:${loginName}`,
  })),
}));

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function Probe({ onChange }) {
  const auth = useAuth();
  React.useEffect(() => onChange(auth), [auth, onChange]);
  return null;
}

async function mountAuth() {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let api;
  const onChange = (nextApi) => {
    api = nextApi;
  };

  await act(async () => {
    root.render(
      <AuthProvider>
        <Probe onChange={onChange} />
      </AuthProvider>
    );
  });

  return {
    get api() {
      return api;
    },
    async flush() {
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    },
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe('AuthContext workspace races', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createWorkspace.mockImplementation(async (loginName) => ({
      login: loginName,
      accountId: `account:${loginName}`,
      storeId: `store:${loginName}`,
    }));
  });

  test('поздний restore не перезаписывает новый signIn', async () => {
    const pendingRestore = deferred();
    restore.mockReturnValue(pendingRestore.promise);
    login.mockResolvedValue({ login: 'new@example.com' });
    const harness = await mountAuth();

    let signInResult;
    await act(async () => {
      signInResult = await harness.api.signIn('new@example.com', 'password');
    });
    expect(signInResult).toBe(true);
    expect(harness.api.workspace).toEqual({
      login: 'new@example.com',
      accountId: 'account:new@example.com',
      storeId: 'store:new@example.com',
    });

    pendingRestore.resolve({ login: 'old@example.com' });
    await harness.flush();

    expect(harness.api.login).toBe('new@example.com');
    expect(createWorkspace).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });

  test('logout инвалидирует незавершённый signIn', async () => {
    restore.mockResolvedValue(null);
    const pendingLogin = deferred();
    login.mockReturnValue(pendingLogin.promise);
    const harness = await mountAuth();

    let signInPromise;
    await act(async () => {
      signInPromise = harness.api.signIn('late@example.com', 'password');
    });
    await act(async () => {
      harness.api.logout();
    });

    const isCurrent = login.mock.calls[0][2].isCurrent;
    expect(isCurrent()).toBe(false);
    pendingLogin.resolve({ login: 'late@example.com' });
    await expect(signInPromise).resolves.toBe(false);
    await harness.flush();

    expect(harness.api.workspace).toBeNull();
    expect(harness.api.isWorkspaceReady).toBe(false);
    expect(logout).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });

  test('более старый параллельный signIn не заменяет новый workspace', async () => {
    restore.mockResolvedValue(null);
    const oldLogin = deferred();
    const newLogin = deferred();
    login
      .mockReturnValueOnce(oldLogin.promise)
      .mockReturnValueOnce(newLogin.promise);
    const harness = await mountAuth();

    let oldPromise;
    let newPromise;
    await act(async () => {
      oldPromise = harness.api.signIn('old@example.com', 'password');
      newPromise = harness.api.signIn('new@example.com', 'password');
    });

    let newResult;
    await act(async () => {
      newLogin.resolve({ login: 'new@example.com' });
      newResult = await newPromise;
    });
    expect(newResult).toBe(true);
    oldLogin.resolve({ login: 'old@example.com' });
    await expect(oldPromise).resolves.toBe(false);
    await harness.flush();

    expect(harness.api.login).toBe('new@example.com');
    expect(createWorkspace).toHaveBeenCalledTimes(1);
    await harness.unmount();
  });
});
