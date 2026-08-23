import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PATHS } from '../app/paths';
import { useAuth } from './AuthContext';

export function useLogout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return useCallback(() => {
    logout();
    navigate(PATHS.home, { replace: true });
  }, [logout, navigate]);
}
