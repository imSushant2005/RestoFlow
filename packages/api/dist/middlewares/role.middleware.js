"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRoles = void 0;
const env_1 = require("../config/env");
const experimentAdminEmails = new Set(['sushantrana2005@gmail.com', ...(env_1.env.EXPERIMENT_ADMIN_EMAILS || [])]
    .map((email) => String(email || '').trim().toLowerCase())
    .filter(Boolean));
const requireRoles = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        if (experimentAdminEmails.has(String(req.user.email || '').trim().toLowerCase())) {
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