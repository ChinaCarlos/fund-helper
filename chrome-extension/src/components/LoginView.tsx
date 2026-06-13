import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isQrExpired, isQrLoginSuccess } from '@/lib/qr-state';
import { yjb } from '@/lib/yjb';
import type { YjbSession } from '@/types/portfolio';

type LoginState = 'loading' | 'waiting' | 'success' | 'expired' | 'error';

interface LoginViewProps {
  onLoggedIn: (session: YjbSession) => void | Promise<void>;
}

export function LoginView({ onLoggedIn }: LoginViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onLoggedInRef = useRef(onLoggedIn);
  const runIdRef = useRef(0);
  const [status, setStatus] = useState<LoginState>('loading');
  const [message, setMessage] = useState('正在获取二维码…');
  const pollRef = useRef<number | null>(null);
  const expireRef = useRef<number | null>(null);

  onLoggedInRef.current = onLoggedIn;

  const clearTimers = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (expireRef.current) window.clearTimeout(expireRef.current);
    pollRef.current = null;
    expireRef.current = null;
  }, []);

  const startLogin = useCallback(async () => {
    const runId = ++runIdRef.current;
    clearTimers();
    setStatus('loading');
    setMessage('正在获取二维码…');

    try {
      const qr = await yjb.getQrcode();
      if (runId !== runIdRef.current) return;

      const canvas = canvasRef.current;
      if (canvas) {
        await QRCode.toCanvas(canvas, qr.url, {
          width: 180,
          margin: 1,
          color: { dark: '#111827', light: '#fafbfc' },
        });
      }

      setStatus('waiting');
      setMessage('请使用微信扫一扫，并在手机上确认授权');

      expireRef.current = window.setTimeout(() => {
        if (runId !== runIdRef.current) return;
        clearTimers();
        setStatus('expired');
        setMessage('二维码已过期，请刷新');
      }, 240_000);

      let pollFailures = 0;

      pollRef.current = window.setInterval(async () => {
        if (runId !== runIdRef.current) return;
        try {
          const result = await yjb.getQrcodeState(qr.id);
          pollFailures = 0;

          if (isQrLoginSuccess(result.state) && result.token) {
            clearTimers();
            setStatus('success');
            setMessage(`登录成功，欢迎 ${result.nickname ?? ''}`);
            await onLoggedInRef.current({
              token: result.token,
              nickname: result.nickname ?? '',
              avatar: result.avatar ?? '',
              login_time: new Date().toISOString(),
            });
          } else if (isQrExpired(result.state)) {
            clearTimers();
            setStatus('expired');
            setMessage('二维码已失效，请刷新');
          }
        } catch (err) {
          pollFailures += 1;
          if (pollFailures >= 2) {
            setMessage(
              err instanceof Error
                ? `状态查询失败：${err.message}`
                : '状态查询失败，请检查网络后刷新二维码',
            );
          }
        }
      }, 2000);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setStatus('error');
      setMessage(err instanceof Error ? err.message : '获取二维码失败');
    }
  }, [clearTimers]);

  useEffect(() => {
    void startLogin();
    return () => {
      runIdRef.current += 1;
      clearTimers();
    };
  }, [startLogin, clearTimers]);

  return (
    <section className="view">
      <header className="header">
        <div className="brand">
          <span className="brand-icon">基</span>
          <div>
            <h1 className="brand-title">Fund Helper</h1>
            <p className="brand-sub">养基宝 · 微信扫码登录</p>
          </div>
        </div>
      </header>

      <div className="login-card">
        <div className="qr-wrap">
          <canvas ref={canvasRef} width={180} height={180} aria-label="登录二维码" />
          {status === 'loading' ? <div className="qr-loading">加载中…</div> : null}
        </div>
        <p className="login-status">{message}</p>
        <ul className="login-tips">
          <li>关注公众号「养基宝」并完成小程序注册</li>
          <li>使用微信扫一扫上方二维码</li>
          <li>扫码后在手机上点击确认授权（仅扫码不够）</li>
        </ul>
        {(status === 'expired' || status === 'error' || status === 'waiting') && (
          <button className="btn btn-secondary" type="button" onClick={() => void startLogin()}>
            刷新二维码
          </button>
        )}
      </div>
    </section>
  );
}
