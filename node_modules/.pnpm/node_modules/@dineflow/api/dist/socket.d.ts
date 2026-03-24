import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
export declare let io: Server;
export declare const getTenantRoom: (tenantId: string) => string;
export declare const getSessionRoom: (tenantId: string, sessionToken: string) => string;
export declare const initSocket: (server: HttpServer) => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export declare const getIO: () => Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
//# sourceMappingURL=socket.d.ts.map