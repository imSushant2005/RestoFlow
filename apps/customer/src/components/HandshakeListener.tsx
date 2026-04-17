import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { getSocketUrl } from '../lib/network';
import { useNotifications } from './Notifications';

export const WAITER_ACK_EVENT = 'rf:waiter-acknowledged';

export function HandshakeListener({
  tenantSlug,
  sessionId,
  sessionAccessToken,
}: {
  tenantSlug: string;
  sessionId: string;
  sessionAccessToken: string;
}) {
  const { notify } = useNotifications();

  useEffect(() => {
    if (!tenantSlug || !sessionId || !sessionAccessToken) return;

    const socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      auth: { tenantSlug, sessionAccessToken }
    });

    socket.on('waiter:acknowledged', (data) => {
      notify({
        title: 'Staff is Coming!',
        message: 'Your request has been accepted. A waiter will be at your table shortly.',
        type: 'success',
      });

      window.dispatchEvent(
        new CustomEvent(WAITER_ACK_EVENT, {
          detail: {
            ...data,
            tenantSlug,
            sessionId,
          },
        }),
      );

      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[DEBUG_HANDSHAKE] Socket connection error:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [notify, sessionAccessToken, sessionId, tenantSlug]);

  return null;
}
