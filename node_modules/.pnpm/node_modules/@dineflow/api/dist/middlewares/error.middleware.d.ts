import { Request, Response, NextFunction } from 'express';
interface StandardError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}
export declare const globalErrorHandler: (err: StandardError, req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=error.middleware.d.ts.map