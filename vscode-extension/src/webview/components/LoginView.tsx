import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isQrExpired, isQrLoginSuccess } from '@/lib/qr-state';
import type { QrStateResult } from '@/types/portfolio';
import { postToExtension, useExtensionMessage } from '@/vscode';

type LoginState = 'loading' | 'waiting' | 'success' | 'expired' | 'error';

export function LoginView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runIdRef = useRef(0);
  const qrIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<LoginState>('loading');
  const [message, setMessage] = useState('正在获取二维码…');
  const pollRef = useRef<number | null>(null);
  const expireRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (expireRef.current) window.clearTimeout(expireRef.current);
    pollRef.current = null;
    expireRef.current = null;
  }, []);

  const drawQr = useCallback(async (url: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const styles = getComputedStyle(document.documentElement);
    const dark = styles.getPropertyValue('--text').trim() || '#cccccc';
    const light = styles.getPropertyValue('--bg').trim() || '#1e1e1e';

    await QRCode.toCanvas(canvas, url, {
      width: 180,
      margin: 1,
      color: { dark, light },
    });
  }, []);

  useExtensionMessage((msg: { type: string; id?: string; url?: string; result?: QrStateResult; message?: string }) => {
    if (msg.type === 'qr' && msg.id && msg.url) {
      qrIdRef.current = msg.id;
      void drawQr(msg.url).then(() => {
        setStatus('waiting');
        setMessage('请使用微信扫一扫，并在手机上确认授权');
      });
    } else if (msg.type === 'qrState' && msg.result) {
      const result = msg.result;
      if (isQrLoginSuccess(result.state)) {
        clearTimers();
        setStatus('success');
        setMessage(`登录成功，欢迎 ${result.nickname ?? ''}`);
      } else if (isQrExpired(result.state)) {
        clearTimers();
        setStatus('expired');
        setMessage('二维码已失效，请刷新');
      }
    } else if (msg.type === 'error' && msg.message) {
      setStatus('error');
      setMessage(msg.message);
    }
  });

  const startLogin = useCallback(() => {
    const runId = ++runIdRef.current;
    clearTimers();
    setStatus('loading');
    setMessage('正在获取二维码…');
    postToExtension({ type: 'startLogin' });

    expireRef.current = window.setTimeout(() => {
      if (runId !== runIdRef.current) return;
      clearTimers();
      setStatus('expired');
      setMessage('二维码已过期，请刷新');
    }, 240_000);

    pollRef.current = window.setInterval(() => {
      if (runId !== runIdRef.current || !qrIdRef.current) return;
      postToExtension({ type: 'pollQr', qrId: qrIdRef.current });
    }, 2000);
  }, [clearTimers]);

  useEffect(() => {
    startLogin();
    return () => {
      runIdRef.current += 1;
      clearTimers();
    };
  }, [startLogin, clearTimers]);

  return (
    <section className="view">
      <header className="header">
        <div className="brand">
          <span className="brand-icon">FH</span>
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
          <button className="btn btn-secondary" type="button" onClick={startLogin}>
            刷新二维码
          </button>
        )}
      </div>
    </section>
  );
}
