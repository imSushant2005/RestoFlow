"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.globalErrorHandler = void 0;
const logger_1 = require("../utils/logger");
const zod_1 = require("zod");
const Sentry = __importStar(require("@sentry/node"));
const globalErrorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const isDevelopment = process.env.NODE_ENV !== 'production';
    Sentry.setContext("Request Context", {
        requestId: req.id,
        tenantId: req.tenantId,
        userId: req.user?.id,
        role: req.user?.role,
        deviceId: req.headers['x-device-id'],
        orderId: req.params.id,
        sessionId: req.params.sessionId,
        idempotencyKey: req.headers['x-idempotency-key']
    });
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