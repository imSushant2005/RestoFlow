import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { UserRole } from '@dineflow/prisma';
type VerifiedAccessToken = {
    userId: string;
    tenantId: string;
    role?: UserRole;
};
type SocketData = {
    user?: VerifiedAccessToken;
    tenantId?: string;
    sessionId?: string;
    connectedAt: number;
};
type ClientToServerEvents = {
    'client:ping': (payload?: {
        sentAt?: number;
    }, ack?: (response: {
        serverTime: string;
        echoedSentAt: number | null;
        latencyHint: number | null;
    }) => void) => void;
    'sync:request': (payload?: unknown, ack?: (response: {
        ok: boolean;
        serverTime: string;
        socketId: string;
    }) => void) => void;
};
type ServerToClientEvents = {
    [event: string]: (...args: any[]) => void;
    'socket:ready': (payload: {
        socketId: string;
        serverTime: string;
        tenantId: string | null;
    }) => void;
    'tenant:presence': (payload: {
        tenantId: string;
        connectedClients: number;
        serverTime: string;
    }) => void;
    'menu:availability_changed': (payload: {
        itemId: string;
        isAvailable: boolean;
    }) => void;
    'order:update': (payload: any) => void;
    'order:new': (payload: any) => void;
    'session:new': (payload: {
        id: string;
        tableId: string | null;
        tableName?: string;
        customerName?: string;
        partySize: number;
        openedAt: Date;
    }) => void;
    'session:update': (payload: {
        sessionId: string;
        status: string;
        updatedAt: string;
    }) => void;
    'session:finished': (payload: {
        sessionId: string;
        tableName?: string;
        totalAmount?: number;
    }) => void;
    'session:settled': (payload: {
        sessionId: string;
        paymentMethod: string;
        status?: string;
        totalAmount?: number;
    }) => void;
    'session:completed': (payload: {
        sessionId: string;
        paymentMethod: string;
        closedAt: string | Date;
    }) => void;
    'orders:bulk_status': (payload: {
        sessionId: string;
        status: string;
        updatedAt: string;
    }) => void;
    'table:status_change': (payload: {
        tableId: string;
        status: string;
        orderNumber?: string;
    }) => void;
    'waiter:call': (payload: {
        tableId?: string;
        tableName: string;
        type: string;
        sessionId?: string | null;
        timestamp: string;
    }) => void;
    'waiter:acknowledged': (payload: {
        sessionId?: string;
        tableId?: string;
        status: 'ACCEPTED';
        timestamp: string;
    }) => void;
    'waiter:pickup_ready': (payload: {
        orderId: string;
        orderNumber: string;
        tableName: string | null;
        zoneName: string | null;
        destinationLabel: string;
        orderType: string;
        itemCount: number;
        readyAt: string | Date;
    }) => void;
    error: (payload: {
        code: string;
        message?: string;
        event?: string;
    }) => void;
};
type InterServerEvents = Record<string, never>;
type SocketServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export declare let io: SocketServer;
export declare const getTenantRoom: (tenantId: string) => string;
export declare const getRoleRoom: (tenantId: string, role: string) => string;
export declare const getSessionRoom: (tenantId: string, sessionToken: string) => string;
export declare function getSocketMetrics(): {
    activeConnections: number;
    totalConnections: number;
    rejectedAuthCount: number;
    handledEventCount: number;
    rateLimitedEventCount: number;
    redisAdapterEnabled: boolean;
    lastConnectionAt: string | null;
    lastDisconnectAt: string | null;
};
export declare function initSocket(server: HttpServer): Promise<SocketServer>;
export declare function getIO(): SocketServer;
export {};
//# sourceMappingURL=socket.d.ts.map