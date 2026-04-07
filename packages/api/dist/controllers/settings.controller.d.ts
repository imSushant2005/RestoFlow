import { Request, Response } from 'express';
export declare const getBusinessSettings: (req: Request, res: Response) => Promise<void>;
export declare const updateBusinessSettings: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const getStaff: (req: Request, res: Response) => Promise<void>;
export declare const createStaff: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateStaff: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteStaff: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=settings.controller.d.ts.map