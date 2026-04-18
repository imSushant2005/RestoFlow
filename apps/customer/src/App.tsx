import { Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { get, set } from 'idb-keyval';
import { NotificationsProvider } from './components/Notifications';
import { CustomerShell } from './components/CustomerShell';
import { LoginPage } from './pages/LoginPage';
import { PartySizePage } from './pages/PartySizePage';
import { Storefront } from './pages/Storefront';
import { OrderStatus } from './pages/OrderStatus';
import { SessionTracker } from './pages/SessionTracker';
import { BillPage } from './pages/BillPage';
import { HistoryPage } from './pages/HistoryPage';
import { ProfilePage } from './pages/ProfilePage';
import { publicApi } from './lib/api';
import { clearLegacyCustomerStorage } from './lib/tenantStorage';
import { LanguageProvider } from './contexts/LanguageContext';

function App() {
  useEffect(() => {
    clearLegacyCustomerStorage();

    const existingSession = localStorage.getItem('startup_session');
    if (!existingSession) {
      localStorage.setItem('startup_session', uuidv4());
    }

    const syncOfflineOrders = async () => {
      const queue: any[] = (await get('offline_orders')) || [];
      if (queue.length === 0) return;

      let newQueue = [...queue];
      for (let i = 0; i < queue.length; i += 1) {
        const order = queue[i];
        try {
          await publicApi.post(`/${order.tenantSlug}/orders`, order.payload, {
            headers: order?.payload?.idempotencyKey
              ? { 'x-idempotency-key': order.payload.idempotencyKey }
              : undefined,
          });
          newQueue = newQueue.filter((queuedOrder) => queuedOrder !== order);
        } catch (error) {
          console.error('Failed to sync order', error);
        }
      }

      await set('offline_orders', newQueue);
    };

    window.addEventListener('online', syncOfflineOrders);
    if (navigator.onLine) void syncOfflineOrders();
    return () => window.removeEventListener('online', syncOfflineOrders);
  }, []);

  return (
    <LanguageProvider>
    <div
      className="min-h-[100dvh] flex flex-col font-sans antialiased"
      style={{ background: 'var(--bg)', color: 'var(--text-1)' }}
    >
      <NotificationsProvider>
        <main className="relative flex flex-1 flex-col">
          <Routes>
            <Route path="/order/:tenantSlug" element={<CustomerShell />}>
              <Route index element={<Storefront />} />
              <Route path="status" element={<OrderStatus />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="session/:sessionId" element={<SessionTracker />} />
              <Route path="session/:sessionId/bill" element={<BillPage />} />
              <Route path=":tableId" element={<LoginPage />} />
              <Route path=":tableId/party" element={<PartySizePage />} />
              <Route path=":tableId/menu" element={<Storefront />} />
            </Route>

            <Route
              path="*"
              element={
                <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
                  <div className="text-5xl">📱</div>
                  <h2 className="text-xl font-black text-gray-800">Scan a QR code to order</h2>
                  <p className="text-sm text-gray-400">Ask your server for the table QR code.</p>
                </div>
              }
            />
          </Routes>
        </main>
      </NotificationsProvider>
    </div>
    </LanguageProvider>
  );
}

export default App;
