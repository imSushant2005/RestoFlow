import { Request, Response } from 'express';
export declare const register: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const clerkSync: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const login: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const changeFirstPassword: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getForgotPasswordQuestion: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const resetForgotPassword: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const refresh: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const logout: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
//# sourceMappingURL=auth.controller.d.ts.map