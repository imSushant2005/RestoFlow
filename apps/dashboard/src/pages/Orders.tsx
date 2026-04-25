import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatINR } from '../lib/currency';
import { TicketCard } from '../components/orders/TicketCard';
import { PipelineCard } from '../components/orders/PipelineCard';
import {
  SessionPaymentMethod,
  MiniPaymentGateMode,
  formatStatusLabel,
  asOrderCode,
  resolveTicketTotal,
  toValidTimestamp,
  isMiniTokenFlowPlan,
  getTableLabel,
  matchesOrderSearch,
  matchesTicketSearch,
  getMiniSessionPaymentStatus,
  getMiniSessionPaymentMethod,
  isMiniAwaitingOnlinePayment,
  getMiniPaymentGateMode,
  applyLiveOrderUpdate,
  getCompactOrderToken,
  normalizeGuestDisplayName,
} from '../lib/orders-live-board';
import { CheckCircle, CreditCard, ReceiptText, RefreshCw, Signal, XCircle, Zap, ChevronRight, Search, Loader2, LayoutGrid, TableProperties, History as HistoryIcon, X, AlertTriangle } from 'lucide-react';
import { InvoiceModal } from './InvoicesPage';
import { KanbanColumn } from '../components/orders/KanbanColumn';
import { usePlanFeatures } from '../hooks/usePlanFeatures';

type DashboardRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'KITCHEN' | 'WAITER';
type BillWorkflowAction = 'AWAITING_BILL' | 'PAID_CASH' | 'PAID_ONLINE';
type SessionActionOptions = {
  shouldClose?: boolean;
  ensureBillFirst?: boolean;
  force?: boolean;
};
type MiniPaymentGateState = {
  id: string;
  status: string;
  order: any;
  mode: MiniPaymentGateMode;
};
type PaymentDeskModalState =
  | {
    kind: 'SETTLE';
    sessionId: string;
    tableLabel: string;
    totalAmount: number;
    sessionStatus: string;
    paymentMethod: SessionPaymentMethod;
  }
  | {
    kind: 'CONFIRM_RECEIPT';
    sessionId: string;
    tableLabel: string;
    totalAmount: number;
  };
const DASHBOARD_PAYMENT_SUBMITTED_EVENT = 'rf:session-payment-submitted';

function readRestaurantSlugFromStorage() {
  try {
    const raw = localStorage.getItem('restaurant');
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return typeof parsed?.slug === 'string' ? parsed.slug.trim() : '';
  } catch {
    return '';
  }
}

function isValidSlug(value: string) {
  return /^[a-z0-9-]+$/i.test(value);
}

function resolveRole(rawRole?: string | null): DashboardRole {
  const normalized = (rawRole || '').toUpperCase();
  if (normalized === 'MANAGER') return 'MANAGER';
  if (normalized === 'CASHIER') return 'CASHIER';
  if (normalized === 'KITCHEN') return 'KITCHEN';
  if (normalized === 'WAITER') return 'WAITER';
  return 'OWNER';
}


export function Orders({ role }: { role?: string }) {
  const queryClient = useQueryClient();
  const effectiveRole = resolveRole(role || localStorage.getItem('userRole'));
  const canViewSessions = effectiveRole !== 'KITCHEN';
  const canViewHistory = effectiveRole !== 'KITCHEN';
  const canCloseSession = effectiveRole === 'OWNER' || effectiveRole === 'MANAGER' || effectiveRole === 'CASHIER';
  const { features, plan } = usePlanFeatures();
  const [localToast, setLocalToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const [paymentDeskModal, setPaymentDeskModal] = useState<PaymentDeskModalState | null>(null);

  useEffect(() => {
    if (localToast) {
      const timer = setTimeout(() => setLocalToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [localToast]);
  const canSetKitchenStages = ['OWNER', 'MANAGER', 'KITCHEN'].includes(effectiveRole);
  const canSetServiceStages = ['OWNER', 'MANAGER', 'CASHIER', 'WAITER'].includes(effectiveRole);
  const canToggleBusyMode = effectiveRole === 'OWNER' || effectiveRole === 'MANAGER';
  const canBulkClose = canCloseSession;
  const isMiniTokenFlow = isMiniTokenFlowPlan(plan);
  const [activeTab, setActiveTab] = useState<'PIPELINE' | 'SESSIONS' | 'HISTORY'>('PIPELINE');
  const [busyMode, setBusyMode] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingMiniSettle, setPendingMiniSettle] = useState<MiniPaymentGateState | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const promptedPaymentSessionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data: businessSettings } = useQuery<any>({
    queryKey: ['settings-business'],
    queryFn: async () => {
      const res = await api.get('/settings/business');
      return res.data;
    },
    staleTime: 1000 * 60,
  });

  const resolveTenantSlug = useCallback(async () => {
    const fromQuery = (businessSettings?.slug || '').trim();
    if (fromQuery && isValidSlug(fromQuery)) return fromQuery;

    const fromStorage = readRestaurantSlugFromStorage().trim();
    if (fromStorage && isValidSlug(fromStorage)) return fromStorage;
    return '';
  }, [businessSettings?.slug]);

  const openTestOrder = async () => {
    const slug = await resolveTenantSlug();
    if (!slug) {
      setLocalToast({
        message: 'Tenant slug missing. Complete Business Profile setup first.',
        type: 'error',
      });
      return;
    }
    window.open(`/order/${slug}`, '_blank', 'noopener,noreferrer');
  };

  const refreshOperationalData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['live-orders'] });
    queryClient.invalidateQueries({ queryKey: ['order-history'] });
    queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
  }, [queryClient]);

  const { data: liveOrders = [], isLoading, isError: isLiveOrdersError } = useQuery<any[]>({
    queryKey: ['live-orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
      return res.data;
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!canCloseSession || paymentDeskModal?.kind === 'CONFIRM_RECEIPT' || isMiniTokenFlow) return;

    const pendingPaymentOrder = liveOrders.find((order: any) => {
      const paymentStatus = String(order?.diningSession?.bill?.paymentStatus || '').toUpperCase();
      return order?.diningSessionId && paymentStatus === 'PENDING_VERIFICATION';
    });

    if (!pendingPaymentOrder?.diningSessionId) return;
    if (promptedPaymentSessionsRef.current.has(pendingPaymentOrder.diningSessionId)) return;

    promptedPaymentSessionsRef.current.add(pendingPaymentOrder.diningSessionId);
    setPaymentDeskModal({
      kind: 'CONFIRM_RECEIPT',
      sessionId: pendingPaymentOrder.diningSessionId,
      tableLabel: getTableLabel(pendingPaymentOrder),
      totalAmount: Number(pendingPaymentOrder?.diningSession?.bill?.totalAmount || pendingPaymentOrder?.totalAmount || 0),
    });
    setLocalToast({
      message: 'Customer marked payment done. Verify the account before confirming.',
      type: 'info',
    });
  }, [canCloseSession, isMiniTokenFlow, liveOrders, paymentDeskModal?.kind]);

  const { data: historyResponse } = useQuery<any>({
    queryKey: ['order-history'],
    queryFn: async () => {
      const res = await api.get('/orders/history?includeCount=false');
      return res.data;
    },
    enabled: activeTab === 'HISTORY',
    placeholderData: () => queryClient.getQueryData(['order-history']),
    staleTime: 1000 * 30,
  });


  const statusMutation = useMutation({
    mutationFn: async ({ id, status, cancelReason }: any) => {
      const res = await api.patch(`/orders/${id}/status`, { status, cancelReason });
      return res.data;
    },
    onMutate: async (newUpdate: any) => {
      await queryClient.cancelQueries({ queryKey: ['live-orders'] });
      const previousState = queryClient.getQueryData(['live-orders']);

      // Optimistically move ticket
      queryClient.setQueryData(['live-orders'], (old: any) => {
        if (!old) return [];
        return old.map((order: any) => {
          if (order.id === newUpdate.id) {
            return {
              ...order,
              status: newUpdate.status,
              __pendingStatus: String(newUpdate.status || '').toUpperCase(),
              __pendingStatusAt: Date.now(),
            };
          }
          return order;
        });
      });

      return { previousState, requestedStatus: newUpdate.status };
    },
    onError: (err: any, variables: any, context: any) => {
      const requestedStatus = String(context?.requestedStatus || variables?.status || '').toUpperCase();
      const recoveryTruth = err.response?.data?.recovery?.truth;
      if (err.response?.status === 409 || err.response?.data?.error === 'OCC_CONFLICT') {
        if (recoveryTruth?.id) {
          queryClient.setQueryData(['live-orders'], (old: any) => applyLiveOrderUpdate(old, recoveryTruth));
        }

        setLocalToast({
          message:
            recoveryTruth?.status && recoveryTruth.status !== requestedStatus
              ? `Another screen already moved this ticket to ${formatStatusLabel(recoveryTruth.status)}.`
              : 'This ticket was already updated elsewhere. Synced latest state.',
          type: 'info',
        });
        return;
      }

      if (!navigator.onLine) {
        setLocalToast({ message: 'You are offline. Cannot change order status.', type: 'error' });
      } else {
        setLocalToast({
          message:
            err?.response?.data?.error ||
            err?.message ||
            'Failed to update status. Restored latest saved state.',
          type: 'error',
        });
      }

      queryClient.setQueryData(['live-orders'], context?.previousState);
    },
    onSuccess: (updatedOrder: any) => {
      if (updatedOrder?.id) {
        queryClient.setQueryData(['live-orders'], (old: any) => applyLiveOrderUpdate(old, updatedOrder));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['live-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-history'] });
      queryClient.invalidateQueries({ queryKey: ['bill-counter-orders'] });
    },
  });

  const finishSessionMutation = useMutation({
    mutationFn: async ({ sessionId, force = false }: { sessionId: string; force?: boolean }) => {
      const slug = await resolveTenantSlug();
      if (!slug) {
        throw new Error('Tenant slug missing. Complete Business Profile setup first.');
      }
      return api.post(`/public/${slug}/sessions/${sessionId}/admin-finish`, { force });
    },
    onSuccess: refreshOperationalData,
  });

  const completeSessionMutation = useMutation({
    mutationFn: async ({
      sessionId,
      paymentMethod,
      shouldClose,
      force = false,
    }: {
      sessionId: string;
      paymentMethod: SessionPaymentMethod;
      shouldClose?: boolean;
      force?: boolean;
    }) => {
      const slug = await resolveTenantSlug();
      if (!slug) {
        throw new Error('Tenant slug missing. Complete Business Profile setup first.');
      }
      const res = await api.post(`/public/${slug}/sessions/${sessionId}/complete`, { paymentMethod, shouldClose, force });
      return res.data;
    },
    onSuccess: refreshOperationalData,
  });

  const sendPaymentLinkMutation = useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const slug = await resolveTenantSlug();
      if (!slug) {
        throw new Error('Tenant slug missing. Complete Business Profile setup first.');
      }
      return api.post(`/public/${slug}/sessions/${sessionId}/payment-link`, {});
    },
    onSuccess: refreshOperationalData,
  });

  const rejectSessionPaymentMutation = useMutation({
    mutationFn: async ({ sessionId, message }: { sessionId: string; message: string }) => {
      const slug = await resolveTenantSlug();
      if (!slug) {
        throw new Error('Tenant slug missing. Complete Business Profile setup first.');
      }
      return api.post(`/public/${slug}/sessions/${sessionId}/payment-reject`, { message });
    },
  });

  const [billSelections, setBillSelections] = useState<Record<string, BillWorkflowAction>>({});

  const openSessionSettlementDesk = useCallback(
    ({
      sessionId,
      tableLabel,
      totalAmount,
      sessionStatus,
      paymentMethod,
    }: {
      sessionId: string;
      tableLabel: string;
      totalAmount: number;
      sessionStatus: string;
      paymentMethod: SessionPaymentMethod;
    }) => {
      setPaymentDeskModal({
        kind: 'SETTLE',
        sessionId,
        tableLabel,
        totalAmount,
        sessionStatus,
        paymentMethod,
      });
    },
    [],
  );

  useEffect(() => {
    if (!canCloseSession || isMiniTokenFlow) return undefined;

    const handlePaymentSubmitted = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const payload = event.detail || {};
      const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId : '';
      if (!sessionId) return;

      if (promptedPaymentSessionsRef.current.has(sessionId)) return;
      promptedPaymentSessionsRef.current.add(sessionId);
      setPaymentDeskModal({
        kind: 'CONFIRM_RECEIPT',
        sessionId,
        tableLabel: payload?.tableName ? `Table ${payload.tableName}` : 'Live session',
        totalAmount: Number(payload?.totalAmount ?? payload?.bill?.totalAmount ?? 0),
      });
    };

    window.addEventListener(DASHBOARD_PAYMENT_SUBMITTED_EVENT, handlePaymentSubmitted);

    return () => {
      window.removeEventListener(DASHBOARD_PAYMENT_SUBMITTED_EVENT, handlePaymentSubmitted);
    };
  }, [canCloseSession, isMiniTokenFlow]);

  const historyTickets = useMemo(() => {
    const historyOrders = historyResponse?.data || [];
    return Object.values(
      historyOrders.reduce((acc: any, order: any) => {
        const groupId = order?.diningSessionId ? `history_session_${order.diningSessionId}` : `history_order_${order.id}`;
        if (!acc[groupId]) {
          acc[groupId] = {
            id: groupId,
            isSession: Boolean(order?.diningSessionId),
            sessionId: order?.diningSessionId,
            session: order?.diningSession,
            table: order?.table,
            orderType: order?.orderType,
            customerName: order?.diningSession?.customer?.name || order?.customerName,
            customerPhone: order?.diningSession?.customer?.phone || order?.customerPhone,
            orders: [],
            createdAt: order?.diningSession?.openedAt || order?.createdAt,
            totalAmount: 0,
          };
        }
        acc[groupId].orders.push(order);
        acc[groupId].totalAmount = resolveTicketTotal(acc[groupId].orders, acc[groupId].session);
        return acc;
      }, {}),
    ).sort((a: any, b: any) => toValidTimestamp(b?.createdAt) - toValidTimestamp(a?.createdAt));
  }, [historyResponse?.data]);

  const handleSelectBillAction = useCallback((sessionId: string, action: string) => {
    setBillSelections((previous) => ({
      ...previous,
      [sessionId]: action as BillWorkflowAction,
    }));
  }, []);

  const handleFinishSession = useCallback((sessionId: string, force = false) => {
    finishSessionMutation.mutate(
      { sessionId, force },
      {
        onError: (error: any) => {
          setLocalToast({
            message: error?.response?.data?.error || error?.message || 'Could not move this table to billing.',
            type: 'error',
          });
        },
      },
    );
  }, [finishSessionMutation]);

  const handleCompleteSession = useCallback(async (
    sessionId: string,
    paymentMethod: SessionPaymentMethod,
    options?: SessionActionOptions,
  ) => {
    const shouldClose = options?.shouldClose ?? true;
    const ensureBillFirst = options?.ensureBillFirst ?? false;
    const force = options?.force ?? false;

    const settle = () => completeSessionMutation.mutateAsync({ sessionId, paymentMethod, shouldClose, force });

    try {
      if (ensureBillFirst) {
        await finishSessionMutation.mutateAsync({ sessionId, force });
      }

      await settle();
      setLocalToast({
        message: shouldClose ? 'Session archived successfully.' : 'Payment recorded successfully.',
        type: 'success',
      });
      return;
    } catch (error: any) {
      const serverMessage = error?.response?.data?.error || error?.message || '';
      const needsBillFirst =
        error?.response?.status === 409 ||
        String(serverMessage).toLowerCase().includes('final bill');

      if (shouldClose && !ensureBillFirst && needsBillFirst) {
        try {
          await finishSessionMutation.mutateAsync({ sessionId, force });
          await settle();
          setLocalToast({
            message: 'Bill generated and session archived successfully.',
            type: 'success',
          });
          return;
        } catch (retryError: any) {
          setLocalToast({
            message:
              retryError?.response?.data?.error ||
              retryError?.message ||
              'Could not record payment and archive this session.',
            type: 'error',
          });
          return;
        }
      }

      setLocalToast({
        message: serverMessage || 'Could not record payment and archive this session.',
        type: 'error',
      });
    }
  }, [completeSessionMutation, finishSessionMutation]);

  const handleUpdateStatus = useCallback((id: string, status: string, cancelReason?: string) => {
    const order = liveOrders.find((o: any) => o.id === id) || liveOrders.find((o: any) => o.diningSessionId === id);
    if (!order) return;

    const isPaid = getMiniSessionPaymentStatus(order) === 'PAID';
    const isSettleRequired = status === 'PREPARING' || status === 'READY' || status === 'SERVED' || status === 'COMPLETE_SETTLE';
    if (isMiniTokenFlow && !isPaid && isSettleRequired && order.diningSessionId) {
      if (isMiniAwaitingOnlinePayment(order)) {
        setLocalToast({
          message: 'Customer chose UPI. Wait for payment submission before the kitchen starts.',
          type: 'info',
        });
        return;
      }
      setPendingMiniSettle({ id, status, order, mode: getMiniPaymentGateMode(order) });
      return;
    }

    statusMutation.mutate({
      id,
      status,
      cancelReason,
      expectedVersion: order?.version || 0
    });
  }, [isMiniTokenFlow, liveOrders, statusMutation]);

  const handleToggleExpandedOrder = useCallback((orderId: string) => {
    setExpandedOrderId((current) => (current === orderId ? null : orderId));
  }, []);

  const pipelineColumns = useMemo(() => {
    const isMiniTokenFlow = isMiniTokenFlowPlan(plan);
    return [
      {
        id: 'col-new',
        label: isMiniTokenFlow ? 'New Tokens' : 'New',
        hint: isMiniTokenFlow ? 'confirm + collect' : 'needs action',
        color: 'text-blue-700',
        bg: 'bg-blue-50/50',
        badge: 'bg-blue-100 text-blue-800',
        filter: (o: any) => o.status === 'NEW',
        pulse: true,
      },
      {
        id: 'col-preparing',
        label: isMiniTokenFlow ? 'Paid / Preparing' : 'Preparing',
        hint: isMiniTokenFlow ? 'token paid, making now' : features.hasKDS ? 'kitchen active' : 'in progress',
        color: 'text-amber-700',
        bg: 'bg-amber-50/50',
        badge: 'bg-amber-100 text-amber-800',
        filter: (o: any) => o.status === 'ACCEPTED' || o.status === 'PREPARING',
        pulse: false,
      },
      {
        id: 'col-ready',
        label: isMiniTokenFlow ? 'Ready for Pickup' : 'Ready',
        hint: isMiniTokenFlow ? 'call the token' : 'serve next',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50/50',
        badge: 'bg-emerald-100 text-emerald-800',
        filter: (o: any) => o.status === 'READY',
        pulse: false,
      },
      {
        id: 'col-served',
        label: isMiniTokenFlow ? 'Completed' : 'Served',
        hint: isMiniTokenFlow ? 'handover done' : 'bill or close',
        color: 'text-slate-500',
        bg: 'bg-slate-100/50',
        badge: 'bg-slate-200 text-slate-600',
        filter: (o: any) => o.status === 'SERVED',
        pulse: false,
      },
    ];
  }, [features.hasKDS, plan]);

  const sortedLiveOrders = useMemo(() => {
    return [...liveOrders].sort((a: any, b: any) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [liveOrders]);

  const filteredLiveOrders = useMemo(
    () => sortedLiveOrders.filter((order: any) => matchesOrderSearch(order, searchQuery)),
    [searchQuery, sortedLiveOrders],
  );

  const liveOrderDisplayIdentityById = useMemo(() => {
    const groupedByName = new Map<string, any[]>();

    sortedLiveOrders.forEach((order: any) => {
      const guestName = normalizeGuestDisplayName(order?.customerName || order?.diningSession?.customer?.name);
      const key = guestName.toLowerCase();
      const bucket = groupedByName.get(key) || [];
      bucket.push(order);
      groupedByName.set(key, bucket);
    });

    const identities = new Map<string, string>();
    groupedByName.forEach((orders) => {
      orders.forEach((order: any, index: number) => {
        const guestName = normalizeGuestDisplayName(order?.customerName || order?.diningSession?.customer?.name);
        const shortToken = getCompactOrderToken(order?.orderNumber, order?.id);
        const prefix = orders.length > 1 ? `${index + 1}-` : '';
        identities.set(order.id, `${prefix}${guestName}#${shortToken}`);
      });
    });

    return identities;
  }, [sortedLiveOrders]);

  const liveOrderSummaryById = useMemo(() => {
    const summaries = new Map<string, string>();

    sortedLiveOrders.forEach((order: any) => {
      const summary = (Array.isArray(order?.items) ? order.items : [])
        .map((item: any) => {
          const name = String(item?.menuItem?.name || item?.name || '').trim();
          const quantity = Number(item?.quantity || 0);
          if (!name) return '';
          return quantity > 1 ? `${quantity}x ${name}` : name;
        })
        .filter(Boolean)
        .slice(0, 4)
        .join(', ');

      summaries.set(order.id, summary || 'No items');
    });

    return summaries;
  }, [sortedLiveOrders]);

  const filteredHistoryTickets = useMemo(
    () => historyTickets.filter((ticket: any) => matchesTicketSearch(ticket, searchQuery)),
    [historyTickets, searchQuery],
  );

  const settlePendingMiniOrder = useCallback(async (paymentMethod: SessionPaymentMethod) => {
    if (!pendingMiniSettle) return;

    const { id, status, order } = pendingMiniSettle;
    setPendingMiniSettle(null);

    const shouldClose = status === 'COMPLETE_SETTLE';

    try {
      const settledSession = await completeSessionMutation.mutateAsync({
        sessionId: order.diningSessionId,
        paymentMethod,
        shouldClose,
        force: false,
      });

      queryClient.setQueryData(['live-orders'], (old: any[] | undefined) => {
        if (!Array.isArray(old)) return old;

        if (shouldClose) {
          return old.filter((liveOrder) => liveOrder?.diningSessionId !== order.diningSessionId);
        }

        return old.map((liveOrder: any) => {
          if (liveOrder?.diningSessionId !== order.diningSessionId) return liveOrder;

          return {
            ...liveOrder,
            diningSession: {
              ...liveOrder.diningSession,
              sessionStatus: settledSession?.sessionStatus || liveOrder.diningSession?.sessionStatus,
              bill: {
                ...liveOrder.diningSession?.bill,
                ...settledSession?.bill,
                paymentStatus: 'PAID',
                paymentMethod,
              },
            },
          };
        });
      });

      if (!shouldClose) {
        statusMutation.mutate({
          id,
          status,
          expectedVersion: order.version || 0,
        });
      } else {
        refreshOperationalData();
      }

      setLocalToast({
        message: shouldClose
          ? 'Payment recorded and session archived.'
          : `Payment recorded and order moved to ${formatStatusLabel(status)}.`,
        type: 'success',
      });
    } catch (error: any) {
      setLocalToast({
        message: error?.response?.data?.error || error?.message || 'Could not record payment for this order.',
        type: 'error',
      });
    }
  }, [completeSessionMutation, pendingMiniSettle, refreshOperationalData, statusMutation]);

  const resolvePendingMiniVerification = useCallback(async (paymentReceived: boolean) => {
    if (!pendingMiniSettle) return;

    const { id, status, order } = pendingMiniSettle;
    const sessionId = order?.diningSessionId;
    const paymentMethod = getMiniSessionPaymentMethod(order);
    const shouldClose = status === 'COMPLETE_SETTLE';
    setPendingMiniSettle(null);

    if (!sessionId) return;

    if (!paymentReceived) {
      try {
        const rejectionMessage =
          paymentMethod === 'online'
            ? 'Payment is not visible yet. Please show your UPI transaction at the counter.'
            : 'Cash has not been received yet. Please pay at the counter.';

        await rejectSessionPaymentMutation.mutateAsync({
          sessionId,
          message: rejectionMessage,
        });

        queryClient.setQueryData(['live-orders'], (old: any[] | undefined) => {
          if (!Array.isArray(old)) return old;
          return old.map((liveOrder: any) => {
            if (liveOrder?.diningSessionId !== sessionId) return liveOrder;
            return {
              ...liveOrder,
              diningSession: {
                ...liveOrder.diningSession,
                bill: {
                  ...liveOrder.diningSession?.bill,
                  paymentStatus: 'UNPAID',
                },
              },
            };
          });
        });

        setLocalToast({
          message:
            paymentMethod === 'online'
              ? 'Asked the customer to show their UPI transaction at the counter.'
              : 'Cash is still pending. Ask the customer to pay at the counter.',
          type: 'info',
        });
      } catch (error: any) {
        setLocalToast({
          message: error?.response?.data?.error || error?.message || 'Could not send the payment check response.',
          type: 'error',
        });
      }
      return;
    }

    try {
      const settledSession = await completeSessionMutation.mutateAsync({
        sessionId,
        paymentMethod,
        shouldClose,
        force: false,
      });

      queryClient.setQueryData(['live-orders'], (old: any[] | undefined) => {
        if (!Array.isArray(old)) return old;

        if (shouldClose) {
          return old.filter((liveOrder) => liveOrder?.diningSessionId !== sessionId);
        }

        return old.map((liveOrder: any) => {
          if (liveOrder?.diningSessionId !== sessionId) return liveOrder;

          return {
            ...liveOrder,
            diningSession: {
              ...liveOrder.diningSession,
              sessionStatus: settledSession?.sessionStatus || liveOrder.diningSession?.sessionStatus,
              bill: {
                ...liveOrder.diningSession?.bill,
                ...settledSession?.bill,
                paymentStatus: 'PAID',
                paymentMethod,
              },
            },
          };
        });
      });

      if (!shouldClose) {
        statusMutation.mutate({
          id,
          status,
          expectedVersion: order.version || 0,
        });
      } else {
        refreshOperationalData();
      }

      setLocalToast({
        message:
          paymentMethod === 'online'
            ? shouldClose
              ? 'UPI verified and token completed.'
              : `UPI verified and token moved to ${formatStatusLabel(status)}.`
            : shouldClose
              ? 'Cash verified and token completed.'
              : `Cash verified and token moved to ${formatStatusLabel(status)}.`,
        type: 'success',
      });
    } catch (error: any) {
      setLocalToast({
        message: error?.response?.data?.error || error?.message || 'Could not verify payment for this token.',
        type: 'error',
      });
    }
  }, [completeSessionMutation, pendingMiniSettle, queryClient, refreshOperationalData, rejectSessionPaymentMutation, statusMutation]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-xl p-6 h-48 animate-pulse"
            style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}
          >
            <div className="w-1/3 h-6 rounded mb-4 shimmer" />
            <div className="w-1/4 h-4 rounded mb-6 shimmer" />
            <div className="space-y-3">
              <div className="w-full h-8 rounded shimmer" />
              <div className="w-5/6 h-8 rounded shimmer" />
            </div>
          </div>
        ))}
      </div>
    );
  }


  const groupedLive = Object.values(
    filteredLiveOrders.reduce((acc: any, order: any) => {
      const fallbackOrderId = asOrderCode(order?.id);
      const groupId = order?.diningSessionId || `single_${fallbackOrderId}`;
      if (!acc[groupId]) {
        acc[groupId] = {
          id: groupId,
          isSession: Boolean(order?.diningSessionId),
          sessionId: order?.diningSessionId,
          session: order?.diningSession,
          table: order?.table,
          orderType: order?.orderType,
          customerName: order?.diningSession?.customer?.name || order?.customerName,
          customerPhone: order?.diningSession?.customer?.phone || order?.customerPhone,
          orders: [],
          createdAt: order?.diningSession?.openedAt || order?.createdAt,
          totalAmount: 0,
        };
      }
      acc[groupId].orders.push(order);
      acc[groupId].totalAmount = resolveTicketTotal(acc[groupId].orders, acc[groupId].session);
      return acc;
    }, {}),
  ).sort((a: any, b: any) => toValidTimestamp(b?.createdAt) - toValidTimestamp(a?.createdAt));


  const readyOrders = liveOrders.filter((order: any) => order.status === 'READY');


  const searchPlaceholder =
    activeTab === 'PIPELINE'
      ? 'Search token, table, guest, phone, or item'
      : activeTab === 'SESSIONS'
        ? 'Search table, guest, invoice, or token'
        : 'Search history by invoice, token, or guest';

  return (
    <>
      {/* Toast */}
      <div className="pointer-events-none fixed bottom-6 left-1/2 z-[300] -translate-x-1/2">
        {localToast && (
          <div className={`flex items-center gap-3 rounded-2xl border border-white/10 px-5 py-3 shadow-2xl backdrop-blur-md text-sm font-bold text-white ${localToast.type === 'error' ? 'bg-rose-600/90' : localToast.type === 'info' ? 'bg-blue-600/90' : 'bg-emerald-600/90'}`}>
            {localToast.type === 'error' && <AlertTriangle size={15} />}
            {localToast.type === 'success' && <CheckCircle size={15} />}
            {localToast.type === 'info' && <Signal size={15} />}
            {localToast.message}
          </div>
        )}
      </div>

      {/* Payment Desk Modal */}
      {paymentDeskModal && (
        <div className="fixed inset-0 z-[210] flex items-end justify-center p-4 sm:items-center">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setPaymentDeskModal(null)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-400">
                  {paymentDeskModal.kind === 'SETTLE' ? 'Billing Desk' : 'Payment Verification'}
                </p>
                <h2 className="mt-1.5 text-xl font-black tracking-tight text-white">{paymentDeskModal.tableLabel}</h2>
                <p className="mt-1 text-sm font-bold text-slate-400">Total {formatINR(paymentDeskModal.totalAmount || 0)}</p>
              </div>
              <button onClick={() => setPaymentDeskModal(null)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {paymentDeskModal.kind === 'SETTLE' && (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <p className="text-xs font-semibold leading-relaxed text-slate-300">
                    {paymentDeskModal.sessionStatus === 'AWAITING_BILL'
                      ? 'The final bill is ready. Choose how payment was received.'
                      : 'Service is done. Move to billing so the guest can see the final bill.'}
                  </p>
                </div>
                {paymentDeskModal.sessionStatus !== 'AWAITING_BILL' && (
                  <button onClick={() => { handleFinishSession(paymentDeskModal.sessionId); setPaymentDeskModal(null); }} className="flex h-14 w-full items-center justify-between rounded-2xl bg-amber-500 px-5 text-sm font-black text-white hover:bg-amber-400 transition-all">
                    <span className="flex items-center gap-3"><ReceiptText size={18} />Move to Billing</span>
                    <ChevronRight size={16} className="opacity-70" />
                  </button>
                )}
                {paymentDeskModal.sessionStatus === 'AWAITING_BILL' && (
                  <>
                    <button onClick={() => { void handleCompleteSession(paymentDeskModal.sessionId, 'cash', { shouldClose: true, ensureBillFirst: false }); setPaymentDeskModal(null); }} className="flex h-14 w-full items-center justify-between rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-500 transition-all">
                      <span className="flex items-center gap-3"><ReceiptText size={18} />Cash Received &amp; Checkout</span>
                      <ChevronRight size={16} className="opacity-70" />
                    </button>
                    <button
                      onClick={() => {
                        if (!businessSettings?.upiId) { setLocalToast({ message: 'Save the UPI ID in Settings first.', type: 'error' }); return; }
                        void sendPaymentLinkMutation.mutateAsync({ sessionId: paymentDeskModal.sessionId })
                          .then(() => { setLocalToast({ message: 'UPI checkout link sent.', type: 'success' }); setPaymentDeskModal(null); })
                          .catch((err: any) => setLocalToast({ message: err?.response?.data?.error || 'Could not send checkout link.', type: 'error' }));
                      }}
                      disabled={sendPaymentLinkMutation.isPending}
                      className="flex h-14 w-full items-center justify-between rounded-2xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-60 transition-all"
                    >
                      <span className="flex items-center gap-3">
                        {sendPaymentLinkMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                        Send Online Checkout Link
                      </span>
                      <ChevronRight size={16} className="opacity-70" />
                    </button>
                  </>
                )}
              </div>
            )}

            {paymentDeskModal.kind === 'CONFIRM_RECEIPT' && (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <p className="text-sm font-bold text-slate-200">Did you receive {formatINR(paymentDeskModal.totalAmount || 0)} in the restaurant account?</p>
                  <p className="mt-2 text-xs font-semibold text-slate-400">Confirm only after checking the UPI or bank app.</p>
                </div>
                <button onClick={() => { void handleCompleteSession(paymentDeskModal.sessionId, 'online', { shouldClose: true, ensureBillFirst: true }); setPaymentDeskModal(null); }} className="flex h-14 w-full items-center justify-between rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-500 transition-all">
                  <span className="flex items-center gap-3"><CheckCircle size={18} />Yes, Payment Received</span>
                  <ChevronRight size={16} className="opacity-70" />
                </button>
                <button
                  onClick={() => {
                    void rejectSessionPaymentMutation.mutateAsync({ sessionId: paymentDeskModal.sessionId, message: 'Payment not visible. Please show it to the desk manager.' })
                      .then(() => { promptedPaymentSessionsRef.current.delete(paymentDeskModal.sessionId); setLocalToast({ message: 'Guest asked to show payment.', type: 'info' }); setPaymentDeskModal(null); })
                      .catch((err: any) => setLocalToast({ message: err?.response?.data?.error || 'Could not send response.', type: 'error' }));
                  }}
                  disabled={rejectSessionPaymentMutation.isPending}
                  className="flex h-14 w-full items-center justify-between rounded-2xl bg-white/5 px-5 text-sm font-black text-white hover:bg-white/10 disabled:opacity-60 transition-all"
                >
                  <span className="flex items-center gap-3">
                    {rejectSessionPaymentMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                    Not Yet
                  </span>
                  <ChevronRight size={16} className="opacity-70" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mini Settle Modal */}
      {pendingMiniSettle && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setPendingMiniSettle(null)} />
          <div className="relative w-full max-w-sm rounded-[2rem] border border-white/5 bg-slate-900 p-7 shadow-2xl">
            {pendingMiniSettle.mode === 'verify' ? (
              <>
                <div className="flex flex-col items-center text-center">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/20">
                    <CheckCircle className="text-blue-400" size={28} />
                  </div>
                  <h2 className="text-xl font-black text-white tracking-tight">Verify / Accept Token</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    Token <span className="text-blue-400">{pendingMiniSettle.order.orderNumber || asOrderCode(pendingMiniSettle.order.id)}</span> stays in New until you confirm.
                  </p>
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm font-black uppercase tracking-widest text-emerald-400">
                    Total {formatINR(pendingMiniSettle.order.totalAmount)}
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">
                    {getMiniSessionPaymentMethod(pendingMiniSettle.order) === 'online' ? 'Check the UPI app before accepting.' : 'Ask counter staff if cash was received.'}
                  </p>
                </div>
                <div className="mt-6 space-y-3">
                  <button onClick={() => { void resolvePendingMiniVerification(true); }} disabled={completeSessionMutation.isPending || rejectSessionPaymentMutation.isPending} className="flex h-14 w-full items-center justify-between rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50 transition-all">
                    <span className="flex items-center gap-3"><CheckCircle size={18} />YES, ACCEPT TOKEN</span><ChevronRight size={16} className="opacity-60" />
                  </button>
                  <button onClick={() => { void resolvePendingMiniVerification(false); }} disabled={completeSessionMutation.isPending || rejectSessionPaymentMutation.isPending} className="flex h-14 w-full items-center justify-between rounded-2xl bg-white/5 px-5 text-sm font-black text-white hover:bg-white/10 disabled:opacity-50 transition-all">
                    <span className="flex items-center gap-3"><RefreshCw size={18} />{getMiniSessionPaymentMethod(pendingMiniSettle.order) === 'online' ? 'ASK TO SHOW UPI' : 'TAKE CASH FIRST'}</span><ChevronRight size={16} className="opacity-60" />
                  </button>
                  <button onClick={() => setPendingMiniSettle(null)} className="h-11 w-full text-sm font-bold text-slate-500 hover:text-slate-300 transition-colors">Close</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center text-center">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-600/20">
                    <CreditCard className="text-blue-400" size={28} />
                  </div>
                  <h2 className="text-xl font-black text-white tracking-tight">Record Counter Payment</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-400">
                    Payment for <span className="text-blue-400">Token {pendingMiniSettle.order.orderNumber || asOrderCode(pendingMiniSettle.order.id)}</span>
                  </p>
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2 text-sm font-black uppercase tracking-widest text-emerald-400">
                    Total {formatINR(pendingMiniSettle.order.totalAmount)}
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  <button onClick={() => { void settlePendingMiniOrder('cash'); }} disabled={completeSessionMutation.isPending} className="flex h-14 w-full items-center justify-between rounded-2xl bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50 transition-all">
                    <span className="flex items-center gap-3"><ReceiptText size={18} />CASH AT COUNTER</span><Zap size={16} className="opacity-50" />
                  </button>
                  <button onClick={() => { void settlePendingMiniOrder('online'); }} disabled={completeSessionMutation.isPending} className="flex h-14 w-full items-center justify-between rounded-2xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-500 disabled:opacity-50 transition-all">
                    <span className="flex items-center gap-3"><Signal size={18} />UPI / ONLINE</span><RefreshCw size={16} className="opacity-50" />
                  </button>
                  <button onClick={() => setPendingMiniSettle(null)} className="h-11 w-full text-sm font-bold text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex h-full min-h-0 flex-col gap-4 p-3 sm:p-5 lg:p-6">

        {/* Command Bar */}
        <div className="flex flex-col gap-2.5">

          {/* Row 1: Header + actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/5 bg-slate-900/80 px-4 py-3.5 lg:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-blue-400">Live Board</p>
                <h1 className="text-lg font-black tracking-tight text-white leading-tight">Orders</h1>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-black text-blue-400">
                  <Signal size={10} /> Synced
                </span>
                {busyMode && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-[10px] font-black text-rose-400">
                    <Zap size={10} /> Busy
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsSearchOpen((v) => !v)}
                className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${isSearchOpen || searchQuery.trim() ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'border border-white/10 bg-white/5 text-slate-400 hover:text-white'}`}
              >
                <Search size={15} />
              </button>
              <button onClick={refreshOperationalData} className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[11px] font-black text-slate-400 hover:text-white transition-colors">
                <RefreshCw size={13} /> Sync
              </button>
              {canToggleBusyMode && (
                <button onClick={() => setBusyMode(!busyMode)} className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-[11px] font-black transition-all ${busyMode ? 'bg-rose-500 text-white shadow-lg shadow-rose-900/30' : 'border border-white/10 bg-white/5 text-slate-400 hover:text-white'}`}>
                  <Zap size={13} /> {busyMode ? 'Busy ON' : 'Busy'}
                </button>
              )}
              {canBulkClose && (
                <button
                  onClick={() => { if (readyOrders.length === 0) return; if (confirm('Mark every READY order as served?')) readyOrders.forEach((order: any) => statusMutation.mutate({ id: order.id, status: 'SERVED' })); }}
                  disabled={readyOrders.length === 0}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[11px] font-black text-slate-400 hover:text-white transition-colors disabled:opacity-30"
                >
                  <XCircle size={13} /> Serve Ready
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Search */}
          {isSearchOpen && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-900/60 px-4 py-3">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-10 w-full rounded-xl border border-white/10 bg-slate-950/60 pl-10 pr-4 text-sm font-semibold text-white outline-none transition focus:border-blue-500/50"
                />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 whitespace-nowrap">
                {activeTab === 'PIPELINE' ? `${filteredLiveOrders.length} live` : activeTab === 'SESSIONS' ? `${groupedLive.length} sessions` : `${filteredHistoryTickets.length} history`}
              </span>
              {searchQuery.trim() && (
                <button onClick={() => setSearchQuery('')} className="text-[10px] font-black text-slate-500 hover:text-white uppercase transition-colors">Clear</button>
              )}
            </div>
          )}

          {/* Row 3: Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {([
              { id: 'PIPELINE' as const, label: 'Order Pipeline', icon: LayoutGrid, count: filteredLiveOrders.length, show: true },
              { id: 'SESSIONS' as const, label: 'Table Sessions', icon: TableProperties, count: groupedLive.length, show: canViewSessions },
              { id: 'HISTORY' as const, label: 'History', icon: HistoryIcon, count: filteredHistoryTickets.length, show: canViewHistory },
            ]).filter((t) => t.show).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-[12px] font-black transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'border border-white/5 bg-slate-900/60 text-slate-400 hover:text-white'}`}
              >
                <tab.icon size={14} />
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-600'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="relative min-h-0 flex-1">

          {activeTab === 'PIPELINE' ? (
            <>
              {(isOffline || isLiveOrdersError) && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center rounded-3xl bg-black/60 backdrop-blur-sm">
                  <div className="flex items-center gap-4 rounded-[2rem] border border-rose-500/30 bg-rose-500/15 px-8 py-6 shadow-2xl">
                    <Signal size={28} className="text-rose-400 animate-pulse" />
                    <div>
                      <p className="text-base font-black text-white">{isOffline ? 'No Internet Connection' : 'Database Connection Lost'}</p>
                      <p className="mt-1 text-xs font-semibold text-rose-200">{isOffline ? 'Check your network.' : 'Retrying automatically...'}</p>
                    </div>
                  </div>
                </div>
              )}
              <div
                className={`flex min-h-0 flex-1 flex-col gap-4 rounded-[2rem] border border-white/5 bg-slate-950/60 p-3 sm:p-4 lg:h-[calc(100dvh-17rem)] lg:flex-row lg:gap-5 lg:overflow-x-auto lg:overflow-y-hidden lg:p-5 ${isOffline || isLiveOrdersError ? 'pointer-events-none opacity-40' : ''}`}
                style={{ background: 'var(--kanban-bg)' }}
              >
                {pipelineColumns.map(({ id, label, color, bg, badge, filter, pulse, hint }) => {
                  const colOrders = filteredLiveOrders.filter(filter);
                  let colOrdersRender = colOrders;

                  if (id === 'col-served') {
                    const uniqueSessions = new Set<string>();
                    const grouped = [] as any[];
                    colOrders.forEach((o: any) => {
                      if (o.diningSessionId) {
                        if (!uniqueSessions.has(o.diningSessionId)) {
                          const sessionOrders = colOrders.filter((co: any) => co.diningSessionId === o.diningSessionId);
                          const composite = { ...o };
                          composite.isGrouped = sessionOrders.length > 1;
                          if (composite.isGrouped) {
                            composite.id = o.diningSessionId;
                            composite.sourceOrderId = o.id;
                            composite.items = sessionOrders.flatMap((so: any) => so.items || []);
                            const uniqueOrderNumbers = [...new Set(sessionOrders.map((so: any) => so.orderNumber || `T-${asOrderCode(so.id)}`))];
                            composite.orderNumber = uniqueOrderNumbers.join(', ');
                          }
                          uniqueSessions.add(o.diningSessionId);
                          grouped.push(composite);
                        }
                      } else {
                        grouped.push(o);
                      }
                    });
                    colOrdersRender = grouped;
                  }

                  return (
                    <KanbanColumn key={id} label={label} color={color} bg={bg} badge={{ count: colOrders.length, className: badge }} pulse={pulse} isActive={activeTab === 'PIPELINE'} hint={hint}>
                      {colOrdersRender.map((order: any) => (
                        <PipelineCard
                          key={order.id}
                          order={order}
                          displayIdentity={liveOrderDisplayIdentityById.get(order.sourceOrderId || order.id)}
                          orderSummary={liveOrderSummaryById.get(order.sourceOrderId || order.id)}
                          expanded={expandedOrderId === String(order.id)}
                          hasKDS={features.hasKDS}
                          canSetKitchenStages={canSetKitchenStages}
                          canSetServiceStages={canSetServiceStages}
                          canCloseSession={canCloseSession}
                          isStatusPending={statusMutation.isPending && (statusMutation.variables?.id === order.id || statusMutation.variables?.id === order.sourceOrderId)}
                          onUpdateStatus={handleUpdateStatus}
                          onFinishSession={handleFinishSession}
                          onCompleteSession={handleCompleteSession}
                          onToggleExpanded={handleToggleExpandedOrder}
                          onOpenSettlementModal={openSessionSettlementDesk}
                          isCompletePending={completeSessionMutation.isPending && completeSessionMutation.variables?.sessionId === order.diningSessionId}
                          plan={plan}
                        />
                      ))}
                      {colOrdersRender.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center opacity-30">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Empty</p>
                        </div>
                      )}
                    </KanbanColumn>
                  );
                })}
              </div>
            </>

          ) : activeTab === 'SESSIONS' ? (
            <div
              className="flex-1 overflow-y-auto custom-scrollbar p-3 rounded-3xl sm:p-4 lg:p-6"
              style={{ background: 'var(--kanban-bg)', border: '1px solid var(--border)' }}
            >
              {groupedLive.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
                  <div className="h-16 w-16 rounded-2xl border border-white/5 bg-slate-900/60 flex items-center justify-center">
                    <TableProperties size={28} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">No Active Sessions</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">Scan a QR code or place a test order to begin.</p>
                  </div>
                  <button onClick={openTestOrder} className="rounded-2xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white hover:bg-blue-500 transition-colors">
                    Create Test Order
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
                  {groupedLive.map((ticket: any) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      plan={plan}
                      canCloseSession={canCloseSession}
                      selectedBillAction={ticket.sessionId ? billSelections[ticket.sessionId] || 'AWAITING_BILL' : 'AWAITING_BILL'}
                      onSelectBillAction={handleSelectBillAction}
                      finishPending={finishSessionMutation.isPending && finishSessionMutation.variables?.sessionId === ticket.sessionId}
                      paymentPending={completeSessionMutation.isPending && completeSessionMutation.variables?.sessionId === ticket.sessionId}
                      onFinishSession={handleFinishSession}
                      onCompleteSession={handleCompleteSession}
                      onOpenSettlementModal={openSessionSettlementDesk}
                      onViewInvoice={(t) => {
                        const sessionBill = t.session?.bill || t.diningSession?.bill;
                        setSelectedInvoice({ ...t, items: (t.orders || []).flatMap((o: any) => o.items || []), diningSession: { bill: sessionBill } });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

          ) : (
            <div
              className="flex-1 overflow-y-auto custom-scrollbar p-3 rounded-3xl sm:p-4 lg:p-6"
              style={{ background: 'var(--kanban-bg)', border: '1px solid var(--border)' }}
            >
              {filteredHistoryTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                  <div className="h-14 w-14 rounded-2xl border border-white/5 bg-slate-900/60 flex items-center justify-center">
                    <HistoryIcon size={24} className="text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                      {searchQuery.trim() ? 'No results found' : 'No history today'}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {searchQuery.trim() ? 'Try token, invoice, guest name, or phone.' : 'History resets daily.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-start">
                  {filteredHistoryTickets.map((ticket: any) => (
                    <TicketCard
                      key={`history_${ticket.id}`}
                      ticket={ticket}
                      plan={plan}
                      canCloseSession={canCloseSession}
                      selectedBillAction={ticket.sessionId ? billSelections[ticket.sessionId] || 'AWAITING_BILL' : 'AWAITING_BILL'}
                      onSelectBillAction={handleSelectBillAction}
                      finishPending={false}
                      paymentPending={false}
                      onFinishSession={handleFinishSession}
                      onCompleteSession={handleCompleteSession}
                      onOpenSettlementModal={openSessionSettlementDesk}
                      onViewInvoice={(t) => {
                        const sessionBill = t.session?.bill || t.diningSession?.bill;
                        setSelectedInvoice({ ...t, items: (t.orders || []).flatMap((o: any) => o.items || []), diningSession: { bill: sessionBill } });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedInvoice && (
        <InvoiceModal
          order={selectedInvoice}
          businessName={businessSettings?.businessName || 'Your Venue'}
          businessAddress={businessSettings?.address || ''}
          businessPhone={businessSettings?.phone || '-'}
          businessGstin={businessSettings?.gstin || '-'}
          taxRate={Number(businessSettings?.taxRate || 5)}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </>
  );
}
