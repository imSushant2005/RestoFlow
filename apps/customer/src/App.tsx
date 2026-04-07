import { Routes, Route } from 'react-router-dom'
import { NotificationsProvider } from './components/Notifications'
import { LoginPage } from './pages/LoginPage'
import { PartySizePage } from './pages/PartySizePage'
import { Storefront } from './pages/Storefront'
import { OrderStatus } from './pages/OrderStatus'
import { SessionTracker } from './pages/SessionTracker'
import { BillPage } from './pages/BillPage'
import { HistoryPage } from './pages/HistoryPage'
import { useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { get, set } from 'idb-keyval'
import { publicApi } from './lib/api'

function App() {
  useEffect(() => {
    const existingSession = localStorage.getItem('startup_session');
    if (!existingSession) {
      localStorage.setItem('startup_session', uuidv4());
    }

    // Domain mapping check removed to avoid hard-coded product names.

    const syncOfflineOrders = async () => {
      const queue: any[] = await get('offline_orders') || [];
      if (queue.length === 0) return;
      let newQueue = [...queue];
      for (let i = 0; i < queue.length; i++) {
        const order = queue[i];
        try {
          await publicApi.post(`/${order.tenantSlug}/orders`, order.payload);
          newQueue = newQueue.filter(o => o !== order);
        } catch (err) {
          console.error('Failed to sync order', err);
        }
      }
      await set('offline_orders', newQueue);
    };

    window.addEventListener('online', syncOfflineOrders);
    if (navigator.onLine) syncOfflineOrders();
    return () => window.removeEventListener('online', syncOfflineOrders);
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col font-sans antialiased" style={{ background: 'var(--bg)', color: 'var(--text-1)' }}>
      <NotificationsProvider>
        <main className="flex-1 flex flex-col">
          <Routes>
          {/* === NEW SESSION FLOW === */}
          {/* Step 1: QR Scan → Login (phone + name) */}
          <Route path="/order/:tenantSlug/:tableId" element={<LoginPage />} />
          
          {/* Step 2: Party Size Selection */}
          <Route path="/order/:tenantSlug/:tableId/party" element={<PartySizePage />} />
          
          {/* Step 3: Menu Browsing + Ordering */}
          <Route path="/order/:tenantSlug/:tableId/menu" element={<Storefront />} />
          
          {/* Step 4: Session Tracker (multi-order view + running bill) */}
          <Route path="/order/:tenantSlug/session/:sessionId" element={<SessionTracker />} />
          
          {/* Step 5: Final Bill */}
          <Route path="/order/:tenantSlug/session/:sessionId/bill" element={<BillPage />} />
          
          {/* Order History */}
          <Route path="/order/:tenantSlug/history" element={<HistoryPage />} />
          
          {/* Legacy: Order Status (kept for backward compatibility) */}
          <Route path="/order/:tenantSlug/status" element={<OrderStatus />} />
          
          {/* Takeaway (no table) — skip home, go to storefront */}
          <Route path="/order/:tenantSlug" element={<Storefront />} />
          
          {/* Fallback */}
          <Route path="*" element={
            <div className="flex flex-col items-center justify-center min-h-[100dvh] text-center px-6 gap-4">
              <div className="text-5xl">📱</div>
              <h2 className="text-xl font-black text-gray-800">Scan a QR code to order</h2>
              <p className="text-gray-400 text-sm">Ask your server for the table QR code.</p>
            </div>
          } />
        </Routes>
        </main>
      </NotificationsProvider>
    </div>
  )
}

export default App
