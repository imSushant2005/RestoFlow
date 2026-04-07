import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getSocketUrl } from '../lib/network';

type SocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

type RealtimeHandlers = Record<string, (payload: any) => void>;

type UseRealtimeSocketOptions = {
  enabled?: boolean;
  token?: string | null;
  handlers?: RealtimeHandlers;
  onReconnect?: () => void;
};

function isAuthSocketError(error: unknown) {
  const message = typeof (error as any)?.message === 'string' ? (error as any).message.toLowerCase() : '';
  return (
    message.includes('authentication error') ||
    message.includes('unauthorized') ||
    message.includes('invalid') ||
    message.includes('expired')
  );
}

export function useRealtimeSocket({
  enabled = true,
  token,
  handlers = {},
  onReconnect,
}: UseRealtimeSocketOptions) {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);
  const onReconnectRef = useRef<typeof onReconnect>(onReconnect);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    if (!enabled) return;

    const accessToken = token ?? localStorage.getItem('accessToken');
    if (!accessToken) {
      setStatus('disconnected');
      return;
    }

    const socket = io(getSocketUrl(), {
      auth: { token: accessToken, client: 'dashboard' },
      transports: ['websocket'],
      rememberUpgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 12000,
    });

    const handleConnect = () => {
      setStatus('connected');
      onReconnectRef.current?.();
      socket.emit('sync:request', { reason: 'connect' }, () => undefined);
    };

    const handleDisconnect = () => {
      setStatus('disconnected');
    };

    const handleConnectError = (error: unknown) => {
      if (isAuthSocketError(error)) {
        // Stop endless reconnect loops when the socket token is no longer valid.
        (socket as Socket).io.opts.reconnection = false;
        setStatus('disconnected');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('userRole');
        window.location.reload();
        return;
      }
      setStatus('reconnecting');
    };

    const handleReconnectAttempt = () => {
      setStatus('reconnecting');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);

    const offHandlers: Array<() => void> = [];
    Object.entries(handlers).forEach(([eventName, handler]) => {
      socket.on(eventName, handler);
      offHandlers.push(() => socket.off(eventName, handler));
    });

    const heartbeatId = window.setInterval(() => {
      if (!socket.connected) return;
      const sentAt = Date.now();
      socket.emit('client:ping', { sentAt }, (response?: { serverTime?: string }) => {
        if (!response) return;
        setLatencyMs(Math.max(0, Date.now() - sentAt));
        setLastHeartbeatAt(response.serverTime || new Date().toISOString());
      });
    }, 8000);

    return () => {
      window.clearInterval(heartbeatId);
      offHandlers.forEach((off) => off());
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.disconnect();
    };
  }, [enabled, handlers, token]);

  return {
    status,
    latencyMs,
    lastHeartbeatAt,
  };
}
