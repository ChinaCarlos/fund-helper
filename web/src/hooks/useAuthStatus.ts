import { useCallback, useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { AuthStatus } from '@/types/auth';

export function useAuthStatus() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.getAuthStatus();
      setStatus(next);
      return next;
    } catch {
      setStatus(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const isAdmin = status?.logged_in === true && status.role === 'admin';

  return { status, loading, isAdmin, reload };
}
