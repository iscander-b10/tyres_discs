import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import indexedDBService from '../services/indexedDBService';
import { useLogout } from './useLogout';

const mockDetach = jest.fn();
const mockFlush = jest.fn();
const mockLogout = jest.fn();
const mockNavigate = jest.fn();

jest.mock('../cart/CartContext', () => ({
  useCart: () => ({ flush: mockFlush, detach: mockDetach }),
}));
jest.mock('./AuthContext', () => ({
  useAuth: () => ({
    logout: mockLogout,
    workspace: { accountId: 'account-a', storeId: 'store-a' },
  }),
}));
jest.mock('../services/indexedDBService', () => ({
  __esModule: true,
  default: { invalidateActiveStore: jest.fn() },
}));
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

function Probe({ onReady }) {
  const executeLogout = useLogout();
  React.useEffect(() => onReady(executeLogout), [executeLogout, onReady]);
  return null;
}

test('logout выполняет flush, detach/invalidate, auth clear и replace navigation', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  let executeLogout;
  await act(async () => {
    root.render(<Probe onReady={(callback) => { executeLogout = callback; }} />);
  });

  await act(async () => executeLogout());

  expect(mockFlush).toHaveBeenCalledTimes(1);
  expect(mockDetach).toHaveBeenCalledTimes(1);
  expect(indexedDBService.invalidateActiveStore).toHaveBeenCalledWith('store-a');
  expect(mockLogout).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  expect(mockFlush.mock.invocationCallOrder[0]).toBeLessThan(
    mockDetach.mock.invocationCallOrder[0]
  );
  expect(mockDetach.mock.invocationCallOrder[0]).toBeLessThan(
    indexedDBService.invalidateActiveStore.mock.invocationCallOrder[0]
  );
  expect(
    indexedDBService.invalidateActiveStore.mock.invocationCallOrder[0]
  ).toBeLessThan(
    mockLogout.mock.invocationCallOrder[0]
  );
  expect(mockLogout.mock.invocationCallOrder[0]).toBeLessThan(
    mockNavigate.mock.invocationCallOrder[0]
  );
  await act(async () => root.unmount());
});
