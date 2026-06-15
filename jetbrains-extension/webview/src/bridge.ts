import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    __jetbrainsBridge__?: {
      postMessage(message: unknown): void;
    };
  }
}

function normalizeMessage<T>(detail: unknown): T {
  if (typeof detail === 'string') {
    try {
      return JSON.parse(detail) as T;
    } catch {
      return detail as T;
    }
  }
  return detail as T;
}

export function postToExtension(message: unknown): void {
  window.__jetbrainsBridge__?.postMessage(message);
}

export function useExtensionMessage<T>(
  handler: (message: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = normalizeMessage<T>((event as CustomEvent<T>).detail);
      handlerRef.current(detail);
    };
    window.addEventListener('jetbrains-message', listener);
    return () => window.removeEventListener('jetbrains-message', listener);
  }, []);
}

export function requestBoot(): void {
  postToExtension({ type: 'boot' });
}
