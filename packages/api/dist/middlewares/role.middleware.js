"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = void 0;
const requireRoles = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        // Superuser Bypass
        if (req.user.email === 'sushantrana2005@gmail.com') {
            return next();
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions' });
        }
        next();
    };
};
exports.requireRoles = requireRoles;
//# sourceMappingURL=role.middleware.js.map