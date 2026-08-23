import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '../app/paths';
import { useCart } from '../cart/CartContext';
import indexedDBService from '../services/indexedDBService';
import { useAuth } from './AuthContext';

export function useLogout() {
  const { logout, workspace } = useAuth();
  const { flush, detach } = useCart();
  const navigate = useNavigate();

  return useCallback(() => {
    flush();
    detach();
    indexedDBService.invalidateActiveStore(workspace?.storeId);
    logout();
    navigate(PATHS.home, { replace: true });
  }, [detach, flush, logout, navigate, workspace?.storeId]);
}
