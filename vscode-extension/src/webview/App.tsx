import { useEffect, useState } from 'react';
import { LoginView } from '@/components/LoginView';
import { PortfolioView } from '@/components/PortfolioView';
import type { PortfolioSnapshot, YjbSession } from '@/types/portfolio';
import { requestBoot, useExtensionMessage } from '@/vscode';

type AppPhase = 'boot' | 'login' | 'portfolio';

export function App() {
  const [phase, setPhase] = useState<AppPhase>('boot');
  const [session, setSession] = useState<YjbSession | null>(null);
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useExtensionMessage((msg: {
    type: string;
    session?: YjbSession | null;
    snapshot?: PortfolioSnapshot | null;
    loading?: boolean;
    message?: string;
  }) => {
    switch (msg.type) {
      case 'session':
        if (msg.session?.token) {
          setSession(msg.session);
          setPhase('portfolio');
        } else {
          setSession(null);
          setSnapshot(null);
          setPhase('login');
        }
        break;
      case 'portfolio':
        if (msg.snapshot) {
          setSnapshot(msg.snapshot);
          setPhase('portfolio');
          setError('');
        }
        break;
      case 'loading':
        setLoading(Boolean(msg.loading));
        break;
      case 'error':
        setError(msg.message ?? '加载失败');
        break;
    }
  });

  useEffect(() => {
    requestBoot();
  }, []);

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
        <LoginView />
      ) : session ? (
        snapshot ? (
          <PortfolioView
            session={session}
            snapshot={snapshot}
            error={error}
            loading={loading}
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
