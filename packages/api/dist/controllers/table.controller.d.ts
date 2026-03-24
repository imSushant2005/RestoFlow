import { Request, Response } from 'express';
export declare const getZones: (req: Request, res: Response) => Promise<void>;
export declare const createZone: (req: Request, res: Response) => Promise<void>;
export declare const createTable: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateTablePosition: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateTableStatus: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createSession: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const deleteTable: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=table.controller.d.ts.map