// src/hooks/useWebSocket.js

import { useEffect, useRef, useCallback } from 'react';

const WS_URL = process.env.REACT_APP_WEBSOCKET_URL;

export function useWebSocket(onMessage) {
  const wsRef        = useRef(null);
  const onMessageRef = useRef(onMessage);

  // keep the ref up to date with the latest callback
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  // open socket once
  useEffect(() => {
    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;

    socket.addEventListener('open', () => console.log('WebSocket connected'));
    socket.addEventListener('error', e => console.error('WebSocket error', e));
    socket.addEventListener('close', () => console.log('WebSocket disconnected'));

    socket.addEventListener('message', e => {
      let parsed = null;
      try {
        parsed = JSON.parse(e.data);
        console.log(e.data);
      } catch {
        console.warn('Non-JSON payload:', e.data);
        return;
      }
      // call the latest handler
      onMessageRef.current(parsed);
    });

    return () => {
      socket.close();
    };
  }, []); // <-- no deps, so it only runs on mount/unmount

  // stable sendMessage
  const sendMessage = useCallback((payload) => {
    const socket = wsRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    } else {
      console.warn('WebSocket not open yet');
    }
  }, []);

  return { sendMessage };
}
