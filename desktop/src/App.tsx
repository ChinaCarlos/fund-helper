import { useCallback, useEffect, useState } from 'react';
import { Flex, Spin } from 'antd';
import { LoginPage } from '@/pages/login';
import { PortfolioPage } from '@/pages/portfolio';
import { SettingsPage } from '@/pages/settings-page';
import { WindowFrame } from '@/components/window-frame';
import { ThemeProvider } from '@/components/theme-provider';
import { AntdProvider } from '@/providers/antd-provider';
import { loadNotificationConfigFromStorage } from '@/services/notificationConfig';
import { isTauriRuntime } from '@/lib/tauri';
import { api, warmupTauriApi } from '@/lib/tauri-api';
import type { AuthStatus } from '@/types/portfolio';

type AppPhase = 'boot' | 'login' | 'portfolio' | 'settings' | 'browser';

function AppContent() {
  const [phase, setPhase] = useState<AppPhase>(() => (isTauriRuntime() ? 'boot' : 'browser'));
  const [auth, setAuth] = useState<AuthStatus | null>(null);

  const boot = useCallback(async () => {
    try {
      const status = await api.getAuthStatus();
      await loadNotificationConfigFromStorage();
      if (status.bound) {
        setAuth(status);
        setPhase('portfolio');
      } else {
        setPhase('login');
      }
    } catch {
      setPhase('login');
    }
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    warmupTauriApi();
    void boot();
    void import('@tauri-apps/api/core').then(({ invoke }) =>
      invoke('update_tray_menu', { showText: '显示 Fund Helper', quitText: '退出' }),
    );
  }, [boot]);

  const handleLoggedIn = useCallback((status: AuthStatus) => {
    setAuth(status);
    setPhase('portfolio');
  }, []);

  const handleLogout = useCallback(() => {
    setAuth(null);
    setPhase('login');
  }, []);

  const avatarUrl = auth?.avatar?.replace(/^http:\/\//, 'https://');

  return (
    <WindowFrame contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden">
      {phase === 'browser' ? (
        <Flex align="center" justify="center" style={{ flex: 1, padding: 32 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 600 }}>请在桌面窗口中运行</p>
            <p style={{ color: '#8b95a8' }}>请执行：pnpm tauri:dev</p>
          </div>
        </Flex>
      ) : phase === 'boot' ? (
        <Flex align="center" justify="center" style={{ flex: 1 }}>
          <Spin tip="启动中…" />
        </Flex>
      ) : phase === 'login' ? (
        <LoginPage onLoggedIn={handleLoggedIn} />
      ) : auth && phase === 'settings' ? (
        <SettingsPage
          nickname={auth.nickname || '养基宝用户'}
          avatarUrl={avatarUrl}
          onBack={() => setPhase('portfolio')}
          onLogout={() => void handleLogout()}
        />
      ) : auth ? (
        <PortfolioPage
          auth={auth}
          onLogout={handleLogout}
          onOpenSettings={() => setPhase('settings')}
        />
      ) : null}
    </WindowFrame>
  );
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="fund-helper-theme">
      <AntdProvider>
        <AppContent />
      </AntdProvider>
    </ThemeProvider>
  );
}
