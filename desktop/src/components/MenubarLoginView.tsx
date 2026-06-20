import QRCode from "qrcode";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractQrToken, isQrExpired, isQrLoginSuccess, isQrWaiting } from "@/lib/qr-state";
import { api } from "@/lib/tauri-api";
import type { AuthStatus } from "@/types/portfolio";

type LoginState = "loading" | "waiting" | "confirming" | "success" | "expired" | "error";

interface MenubarLoginViewProps {
  onLoggedIn: (status: AuthStatus) => void;
}

const POLL_MS = 1500;

function isDarkTheme(): boolean {
  return (
    document.documentElement.classList.contains("dark") ||
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function MenubarLoginView({ onLoggedIn }: MenubarLoginViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onLoggedInRef = useRef(onLoggedIn);
  const runIdRef = useRef(0);
  const pollRef = useRef<number | null>(null);
  const expireRef = useRef<number | null>(null);
  const [status, setStatus] = useState<LoginState>("loading");
  const [message, setMessage] = useState("正在获取二维码…");

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
        setStatus("confirming");
        setMessage("绑定成功，正在进入…");
        const auth = await api.completeQrLogin({
          token,
          nickname: result.nickname?.trim() ?? "",
          avatar: result.avatar?.trim() ?? "",
        });
        if (runId !== runIdRef.current) return;
        setStatus("success");
        onLoggedInRef.current(auth);
        return;
      }
      if (isQrExpired(result.state)) {
        clearTimers();
        setStatus("expired");
        setMessage("二维码已失效，请刷新");
        return;
      }
      if (!isQrWaiting(result.state)) {
        setMessage("等待手机确认授权…");
      }
    },
    [clearTimers]
  );

  const startPolling = useCallback(
    (qrId: string, runId: number) => {
      clearTimers();
      expireRef.current = window.setTimeout(() => {
        if (runId !== runIdRef.current) return;
        clearTimers();
        setStatus("expired");
        setMessage("二维码已过期，请刷新");
      }, 240_000);
      void pollOnce(qrId, runId);
      pollRef.current = window.setInterval(() => {
        void pollOnce(qrId, runId).catch(() => setMessage("状态查询失败，请检查网络"));
      }, POLL_MS);
    },
    [clearTimers, pollOnce]
  );

  const startLogin = useCallback(async () => {
    const runId = ++runIdRef.current;
    clearTimers();
    setStatus("loading");
    setMessage("正在获取二维码…");
    try {
      const qr = await api.createQr();
      if (runId !== runIdRef.current) return;
      const canvas = canvasRef.current;
      if (canvas) {
        const dark = isDarkTheme();
        await QRCode.toCanvas(canvas, qr.url, {
          width: 168,
          margin: 1,
          color: {
            dark: dark ? "#ffd6d6" : "#fc4e50",
            light: dark ? "#1a1010" : "#fff5f5",
          },
        });
      }
      setStatus("waiting");
      setMessage("请使用微信扫一扫，并在手机上确认授权");
      startPolling(qr.id, runId);
    } catch (err) {
      if (runId !== runIdRef.current) return;
      setStatus("error");
      setMessage(
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "获取二维码失败"
      );
    }
  }, [clearTimers, startPolling]);

  useEffect(() => {
    void startLogin();
    return () => {
      runIdRef.current += 1;
      clearTimers();
    };
  }, [startLogin, clearTimers]);

  const showRefresh = status === "expired" || status === "error" || status === "waiting";

  return (
    <div className="menubar-login menubar-login--brand">
      <header className="menubar-login-header">
        <div className="menubar-login-brand">
          <span className="menubar-login-mark">基</span>
          <div>
            <h1 className="menubar-login-title">Fund Helper</h1>
            <p className="menubar-login-sub">养基宝 · 微信扫码登录</p>
          </div>
        </div>
      </header>

      <div className="menubar-login-card">
        <div className="menubar-qr-wrap">
          <canvas ref={canvasRef} width={168} height={168} aria-label="登录二维码" />
          {status === "loading" || status === "confirming" ? (
            <div className="menubar-qr-overlay">
              <div className="menubar-spinner" />
              <span>{status === "loading" ? "加载中…" : "进入中…"}</span>
            </div>
          ) : null}
        </div>

        <p className="menubar-login-status">{message}</p>

        <ul className="menubar-login-tips">
          <li>关注公众号「养基宝」并完成小程序注册</li>
          <li>使用微信扫一扫上方二维码</li>
          <li>扫码后在手机上点击确认授权</li>
        </ul>

        {showRefresh ? (
          <button
            type="button"
            className="menubar-btn-primary menubar-login-refresh"
            onClick={() => void startLogin()}
          >
            刷新二维码
          </button>
        ) : null}

        <p className="menubar-login-hint">二维码有效期约 4 分钟</p>
      </div>
    </div>
  );
}
