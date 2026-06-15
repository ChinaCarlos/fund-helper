import { useCallback, useEffect, useRef, useState } from 'react';
import { LoginView } from '@/components/LoginView';
import { PortfolioView } from '@/components/PortfolioView';
import { PORTFOLIO_AUTO_REFRESH_MS } from '@/constant';
import { YjbApiError } from '@/lib/yjb';
import { fetchPortfolioSnapshot } from '@/lib/portfolio';
import { clearSession, loadSession, saveSession } from '@/lib/storage';
import type { PortfolioSnapshot, YjbSession } from '@/types/portfolio';

type AppPhase = 'boot' | 'login' | 'portfolio';

export function App() {
  const [phase, setPhase] = useState<AppPhase>('boot');
  const [session, setSession] = useState<YjbSession | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const portfolioFetchInFlight = useRef(false);

  const loadPortfolio = useCallback(async (current: YjbSession, options?: { silent?: boolean }) => {
    if (portfolioFetchInFlight.current) {
      return;
    }
    portfolioFetchInFlight.current = true;
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
    }
    setError('');
    try {
      const data = await fetchPortfolioSnapshot(current.token);
      setSnapshot(data);
      setPhase('portfolio');
    } catch (err) {
      if (err instanceof YjbApiError && err.statusCode === 401) {
        await clearSession();
        setSession(null);
        setSnapshot(null);
        setPhase('login');
        return;
      }
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      portfolioFetchInFlight.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (phase !== 'portfolio' || !session?.token) {
      return;
    }

    const timer = window.setInterval(() => {
      const current = sessionRef.current;
      if (current?.token) {
        void loadPortfolio(current, { silent: true });
      }
    }, PORTFOLIO_AUTO_REFRESH_MS);

    return () => window.clearInterval(timer);
  }, [phase, session?.token, loadPortfolio]);

  useEffect(() => {
    void (async () => {
      const saved = await loadSession();
      if (!saved?.token) {
        setPhase('login');
        return;
      }
      setSession(saved);
      await loadPortfolio(saved);
    })();
  }, [loadPortfolio]);

  const handleLoggedIn = useCallback(async (next: YjbSession) => {
    await saveSession(next);
    setSession(next);
    setPhase('portfolio');
    await loadPortfolio(next);
  }, [loadPortfolio]);

  const handleLogout = async () => {
    await clearSession();
    setSession(null);
    setSnapshot(null);
    setError('');
    setPhase('login');
  };

  if (phase === 'boot') {
    return (
      <div className="app app-center">
        <div className="spinner" aria-label="加载中" />
      </div>
    );
  }

  return (
    <div className="app">
      {phase === 'login' ? (
        <LoginView onLoggedIn={handleLoggedIn} />
      ) : session ? (
        snapshot ? (
          <PortfolioView
            session={session}
            snapshot={snapshot}
            error={error}
            loading={loading}
            onRefresh={() => loadPortfolio(session)}
            onLogout={handleLogout}
          />
        ) : (
          <div className="app-center">
            <div className="spinner" aria-label="加载持仓" />
            {error ? <div className="error-banner">{error}</div> : null}
          </div>
        )
      ) : null}
    </div>
  );
}
