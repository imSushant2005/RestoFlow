import { Request, Response } from 'express';
export declare const getCategories: (req: Request, res: Response) => Promise<void>;
export declare const createCategory: (req: Request, res: Response) => Promise<void>;
export declare const reorderCategories: (req: Request, res: Response) => Promise<void>;
export declare const getMenuItems: (req: Request, res: Response) => Promise<void>;
export declare const createMenuItem: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const updateMenuItem: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const reorderMenuItems: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const bulkUpdateAvailability: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const toggleItemAvailability: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const bulkImportMenu: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=menu.controller.d.ts.map