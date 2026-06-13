import { useEffect, useState } from 'react';
import { api } from '@/lib/tauri-api';
import type { IncomeLineData } from '@/types/portfolio';

function emptyLine(accountId: number): IncomeLineData {
  return { account_id: accountId, day: '', today_income: 0, points: [] };
}

export function useIncomeLines(accountIds: number[], refreshKey?: string) {
  const [collectLine, setCollectLine] = useState<IncomeLineData | null>(null);
  const [linesByAccount, setLinesByAccount] = useState<Record<number, IncomeLineData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const idsKey = accountIds.join(',');

  useEffect(() => {
    if (accountIds.length === 0) {
      setCollectLine(null);
      setLinesByAccount({});
      setLoading(false);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([
      api.getCollectIncomeLine(),
      api.getAccountIncomeLines(accountIds),
    ])
      .then(([collect, lines]) => {
        if (cancelled) return;

        const mapped: Record<number, IncomeLineData> = {};
        for (const accountId of accountIds) {
          mapped[accountId] = lines[String(accountId)] ?? emptyLine(accountId);
        }

        setCollectLine(collect);
        setLinesByAccount(mapped);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '收益曲线加载失败');
          setCollectLine(null);
          setLinesByAccount({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [idsKey, refreshKey]);

  return { collectLine, linesByAccount, loading, error };
}
