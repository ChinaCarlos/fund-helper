import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isAppAuthError, isYjbAuthError } from '@/api/client';
import type { PortfolioSnapshot } from '@/types/portfolio';

interface UsePortfolioOptions {
  enabled?: boolean;
  onAppAuthRequired?: () => void;
  onYjbRequired?: () => void;
}

export function usePortfolio(options: UsePortfolioOptions = {}) {
  const { enabled = true } = options;
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAppAuthRequiredRef = useRef(options.onAppAuthRequired);
  const onYjbRequiredRef = useRef(options.onYjbRequired);
  onAppAuthRequiredRef.current = options.onAppAuthRequired;
  onYjbRequiredRef.current = options.onYjbRequired;

  const load = useCallback(
    async (isRefresh = false): Promise<PortfolioSnapshot | null> => {
      if (!enabled) {
        setLoading(false);
        return null;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await api.getPortfolio();
        setPortfolio(data);
        return data;
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载失败';
        if (isYjbAuthError(message)) {
          onYjbRequiredRef.current?.();
          return null;
        }
        if (isAppAuthError(message)) {
          onAppAuthRequiredRef.current?.();
          return null;
        }
        setError(message);
        return null;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [enabled],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { portfolio, loading, refreshing, error, refresh };
}
