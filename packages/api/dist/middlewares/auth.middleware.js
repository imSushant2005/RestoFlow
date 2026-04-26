"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAuth = void 0;
const jwt_1 = require("../utils/jwt");
const prisma_1 = require("../db/prisma");
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = (0, jwt_1.verifyAccessToken)(token);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                tenantId: true,
                role: true,
                email: true,
                isActive: true,
            },
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Account is inactive' });
        }
        req.user = {
            id: user.id,
            tenantId: user.tenantId,
            role: user.role,
            email: user.email,
        };
        req.tenantId = user.tenantId; // Enforces tenant isolation scoping
        next();
    }
    catch (error) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
    }
};
exports.requireAuth = requireAuth;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ success: false, error: 'Unauthorized: User role not found' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.middleware.js.map