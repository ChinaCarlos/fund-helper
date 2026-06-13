import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Spin, Typography } from 'antd';
import { ThemeToggle } from '@/components/theme-toggle';
import { useTheme } from '@/components/theme-provider';
import { api } from '@/lib/tauri-api';
import {
  extractQrToken,
  isQrExpired,
  isQrLoginSuccess,
  isQrWaiting,
} from '@/lib/qr-state';
import type { AuthStatus } from '@/types/portfolio';

const { Title, Paragraph } = Typography;

type LoginState = 'loading' | 'waiting' | 'confirming' | 'success' | 'expired' | 'error';

interface LoginPageProps {
  onLoggedIn: (status: AuthStatus) => void;
}

const POLL_MS = 1500;

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const { resolvedTheme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onLoggedInRef = useRef(onLoggedIn);
  const runIdRef = useRef(0);
  const pollRef = useRef<number | null>(null);
  const expireRef = useRef<number | null>(null);
  const [status, setStatus] = useState<LoginState>('loading');
  const [message, setMessage] = useState('正在获取二维码…');

  onLoggedInRef.current = onLoggedIn;

  const clearTimers = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (expireRef.current !== null) {
      window.clearTimeout(expireRef.current);
      expireRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(
    async (qrId: string, runId: number) => {
      if (runId !== runIdRef.current) return;
      const result = await api.pollQrState(qrId);
      if (runId !== runIdRef.current) return;

      const token = extractQrToken(result.token);
      if (isQrLoginSuccess(result.state) && token) {
        clearTimers();
        setStatus('confirming');
        setMessage('绑定成功，正在进入…');
        const auth = await api.completeQrLogin({
          token,
          nickname: result.nickname?.trim() ?? '',
          avatar: result.avatar?.trim() ?? '',
        });
        if (runId !== runIdRef.current) return;
        setStatus('success');
        onLoggedInRef.current(auth);
        return;
      }
      if (isQrExpired(result.state)) {
        clearTimers();
        setStatus('expired');
        setMessage('二维码已失效，请刷新');
        return;
      }
      if (!isQrWaiting(result.state)) {
        setMessage('等待手机确认授权…');
      }
    },
    [clearTimers],
  );

  const startPolling = useCallback(
    (qrId: string, runId: number) => {
      clearTimers();
      expireRef.current = window.setTimeout(() => {
        if (runId !== runIdRef.current) return;
        clearTimers();
        setStatus('expired');
        setMessage('二维码已过期，请刷新');
      }, 240_000);
      void pollOnce(qrId, runId);
      pollRef.current = window.setInterval(() => {
        void pollOnce(qrId, runId).catch(() => setMessage('状态查询失败，请检查网络'));
      }, POLL_MS);
    },
    [clearTimers, pollOnce],
  );

  const startLogin = useCallback(async () => {
    const runId = ++runIdRef.current;
    clearTimers();
    setStatus('loading');
    setMessage('正在获取二维码…');
    try {
      const qr = await api.createQr();
      if (runId !== runIdRef.current) return;
      const canvas = canvasRef.current;
      if (canvas) {
        void QRCode.toCanvas(canvas, qr.url, {
          width: 220,
          margin: 2,
          color: {
            dark: resolvedTheme === 'dark' ? '#e2e8f0' : '#1e293b',
            light: resolvedTheme === 'dark' ? '#161b22' : '#ffffff',
          },
        });
      }
      setStatus('waiting');
      setMessage('请使用微信扫一扫，并在手机上确认授权');
      startPolling(qr.id, runId);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setStatus('error');
      setMessage(err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : '获取二维码失败');
    }
  }, [clearTimers, startPolling]);

  useEffect(() => {
    void startLogin();
    return () => {
      runIdRef.current += 1;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Flex
      align="center"
      justify="center"
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: 24,
        background: 'var(--background)',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>
      <Card style={{ width: '100%', maxWidth: 520 }} bordered={false}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>
          绑定养基宝账号
        </Title>
        <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: 16 }}>
          持仓数据来自养基宝，需完成以下步骤后再扫码
        </Paragraph>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
          message="绑定前请确认"
          description={
            <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
              <li>已关注微信公众号「养基宝」</li>
              <li>已在养基宝小程序或 App 完成注册并登录</li>
              <li>使用微信扫一扫下方二维码，并在手机上确认授权</li>
            </ol>
          }
        />

        <Flex
          align="center"
          justify="center"
          style={{
            width: 240,
            height: 240,
            margin: '0 auto 24px',
            background: '#fafbfc',
            borderRadius: 12,
            border: '1px solid #eef1f6',
            position: 'relative',
          }}
        >
          <canvas ref={canvasRef} width={220} height={220} aria-label="登录二维码" />
          {status === 'loading' || status === 'confirming' ? (
            <Flex
              align="center"
              justify="center"
              style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.9)', borderRadius: 12 }}
            >
              <Spin tip={status === 'loading' ? '加载中…' : '进入中…'} />
            </Flex>
          ) : null}
        </Flex>

        <Paragraph style={{ textAlign: 'center', marginBottom: 16 }}>{message}</Paragraph>

        {(status === 'expired' || status === 'error' || status === 'waiting') && (
          <Flex justify="center" style={{ marginBottom: 16 }}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => void startLogin()}>
              刷新二维码
            </Button>
          </Flex>
        )}

        <Paragraph type="secondary" style={{ fontSize: 13, textAlign: 'center', marginBottom: 0 }}>
          二维码有效期约 4 分钟
        </Paragraph>
      </Card>
    </Flex>
  );
}
