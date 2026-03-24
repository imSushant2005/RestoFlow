import { Request, Response } from 'express';
export declare const getOrders: (req: Request, res: Response) => Promise<void>;
export declare const getOrderHistory: (req: Request, res: Response) => Promise<void>;
export declare const updateOrderStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=order.controller.d.ts.map