"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const logger_1 = require("../utils/logger");
const zod_1 = require("zod");
const globalErrorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const isDevelopment = process.env.NODE_ENV !== 'production';
    // Automatically Catch Zod validation errors
    if (err instanceof zod_1.ZodError) {
        const formattedErrors = err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
        }));
        logger_1.logger.warn({ path: req.path, method: req.method, ip: req.ip, errors: formattedErrors }, 'Validation Error');
        res.status(400).json({
            success: false,
            error: 'Validation Error',
            validation: formattedErrors,
        });
        return;
    }
    // Catch known Prisma database errors (Optional refinement based on Prisma code strings)
    if (err.name === 'PrismaClientKnownRequestError') {
        logger_1.logger.error({ err, path: req.path }, 'Database Request Error');
        res.status(400).json({
            success: false,
            error: 'Database constraint violation.',
            ...(isDevelopment && { details: err.message })
        });
        return;
    }
    // Log 500s directly to infrastructure
    if (statusCode === 500) {
        logger_1.logger.error({ err, path: req.path, method: req.method, ip: req.ip }, '💥 Unhandled Server Exception');
    }
    else {
        logger_1.logger.warn({ err: err.message, path: req.path }, `Operational Error (${statusCode})`);
    }
    res.status(statusCode).json({
        success: false,
        error: err.isOperational ? err.message : 'Internal Server Error',
        ...(isDevelopment && { stack: err.stack }), // Leak stack trace only heavily in internal tests
    });
};
exports.globalErrorHandler = globalErrorHandler;
//# sourceMappingURL=error.middleware.js.map