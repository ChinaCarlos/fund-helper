import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { App as AntApp, ConfigProvider, Flex, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { api } from '@/api/client';
import { clearNotificationConfigCache, syncNotificationConfigFromServer } from '@/services/notificationConfig';
import { Dashboard } from '@/pages/Dashboard/Dashboard';
import { Login } from '@/pages/Login/Login';
import { MarketHeatmap } from '@/pages/MarketHeatmap/MarketHeatmap';
import { MarketRanking } from '@/pages/MarketRanking/MarketRanking';
import { Settings } from '@/pages/Settings/Settings';
import { UserManagement } from '@/pages/UserManagement/UserManagement';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((status) => {
        setLoggedIn(status.logged_in);
        if (status.logged_in) {
          void syncNotificationConfigFromServer();
        } else {
          clearNotificationConfigCache();
        }
      })
      .catch(() => {
        setLoggedIn(false);
        clearNotificationConfigCache();
      })
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Spin tip="正在检查登录状态..." />
      </Flex>
    );
  }

  if (!loggedIn) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((status) => setAllowed(status.logged_in && status.role === 'admin'))
      .catch(() => setAllowed(false))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Spin tip="正在检查权限..." />
      </Flex>
    );
  }

  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#fc4e50',
          borderRadius: 10,
          colorBgLayout: '#f5f7fb',
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/market/heatmap"
              element={
                <ProtectedRoute>
                  <MarketHeatmap />
                </ProtectedRoute>
              }
            />
            <Route
              path="/market"
              element={
                <ProtectedRoute>
                  <MarketRanking />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <UserManagement />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
