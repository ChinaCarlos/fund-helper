import { useEffect, useRef } from 'react';

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscodeApi = acquireVsCodeApi();

export function postToExtension(message: unknown): void {
  vscodeApi.postMessage(message);
}

export function useExtensionMessage<T>(
  handler: (message: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      handlerRef.current(event.data as T);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, []);
}

export function requestBoot(): void {
  postToExtension({ type: 'boot' });
}
