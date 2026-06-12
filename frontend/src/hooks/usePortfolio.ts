import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/api/client';
import type { PortfolioSnapshot } from '@/types/portfolio';

interface UsePortfolioOptions {
  onAuthRequired?: () => void;
}

export function usePortfolio(options: UsePortfolioOptions = {}) {
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAuthRequiredRef = useRef(options.onAuthRequired);
  onAuthRequiredRef.current = options.onAuthRequired;

  const load = useCallback(async (isRefresh = false): Promise<PortfolioSnapshot | null> => {
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
      if (message.includes('未登录') || message.includes('401')) {
        onAuthRequiredRef.current?.();
        return null;
      }
      setError(message);
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { portfolio, loading, refreshing, error, refresh };
}
