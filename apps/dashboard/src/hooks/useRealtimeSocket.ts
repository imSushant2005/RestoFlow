import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { clearDashboardAuthStorage, hasRecentManualLogout } from '../lib/authSession';
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
  const handlersRef = useRef<RealtimeHandlers>(handlers);
  const onReconnectRef = useRef<typeof onReconnect>(onReconnect);
  const socketRef = useRef<Socket | null>(null);


  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  useEffect(() => {
    if (!enabled) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setStatus('disconnected');
      setLatencyMs(null);
      setLastHeartbeatAt(null);
      return;
    }

    const accessToken = token ?? localStorage.getItem('accessToken');
    if (!accessToken) {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');

    const socket = io(getSocketUrl(), {
      auth: { token: accessToken, client: 'dashboard' },
      transports: ['websocket', 'polling'],
      rememberUpgrade: false,
      reconnection: true,
      reconnectionAttempts: 12,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 12000,
    });

    socketRef.current = socket;

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
        socket.io.opts.reconnection = false;
        setStatus('disconnected');
        clearDashboardAuthStorage();
        if (!hasRecentManualLogout() && window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
        return;
      }
      setStatus('reconnecting');
    };

    const handleReconnectAttempt = () => {
      setStatus('reconnecting');
    };

    const handleReconnectFailed = () => {
      setStatus('disconnected');
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.io.on('reconnect_failed', handleReconnectFailed);

    // Dynamic event registration via the ref
    const events = [
      'order:new',
      'order:update',
      'orders:bulk_status',
      'waiter:call',
      'table:status_change',
      'session:new',
      'session:update',
      'session:finished',
      'session:completed'
    ];

    events.forEach(eventName => {
      socket.on(eventName, (payload) => {
        const handler = handlersRef.current[eventName];
        if (handler) handler(payload);
      });
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
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, token]);


  return {
    status,
    latencyMs,
    lastHeartbeatAt,
  };
}
