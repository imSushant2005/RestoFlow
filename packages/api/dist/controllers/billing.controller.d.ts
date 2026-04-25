import { Request, Response } from 'express';
export declare const getBillingDetails: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const startTrial: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const createCheckoutSession: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const confirmPayment: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const failPayment: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const refundPayment: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const cancelSubscription: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=billing.controller.d.ts.map