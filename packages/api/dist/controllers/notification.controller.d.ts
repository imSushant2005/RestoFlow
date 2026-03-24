import { Request, Response } from 'express';
export declare const subscribeToPush: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getVapidPublicKey: (req: Request, res: Response) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=notification.controller.d.ts.map