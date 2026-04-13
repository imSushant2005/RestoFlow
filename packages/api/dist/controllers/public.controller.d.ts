import { Request, Response } from 'express';
export declare const getPublicMenu: (req: Request, res: Response) => Promise<void>;
export declare const resolveCustomDomain: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createOrder: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getOrderInfo: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getSessionOrders: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const submitFeedback: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const waiterCall: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
/**
 * Staff Acknowledgment of a waiter call.
 * This notifies the specific guest that help is arriving.
 */
export declare const acknowledgeWaiterCall: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=public.controller.d.ts.map