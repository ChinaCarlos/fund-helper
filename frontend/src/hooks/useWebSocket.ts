import { useEffect, useRef, useState } from 'react';
import type { PortfolioSnapshot, WsMessage } from '@/types/portfolio';

interface UseWebSocketOptions {
  onAuthRequired?: () => void;
  onAuthOk?: (nickname?: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${protocol}://${window.location.host}/ws`);

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!disposed) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => setError('WebSocket 连接异常');
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data) as WsMessage;
        switch (message.type) {
          case 'portfolio_update':
            setPortfolio(message.data);
            setError(null);
            break;
          case 'auth_required':
            optionsRef.current.onAuthRequired?.();
            break;
          case 'auth_ok':
            optionsRef.current.onAuthOk?.(message.data.nickname);
            break;
          case 'error':
            setError(message.message);
            break;
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);

  return { connected, portfolio, error };
}
