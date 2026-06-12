import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConfigProvider, Flex, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { api } from '@/api/client';
import { Dashboard } from '@/pages/Dashboard/Dashboard';
import { Login } from '@/pages/Login/Login';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((status) => setLoggedIn(status.logged_in))
      .catch(() => setLoggedIn(false))
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
