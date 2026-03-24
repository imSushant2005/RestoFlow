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
const express_1 = require("express");
const env_1 = require("../config/env");
const AdminController = __importStar(require("../controllers/admin.controller"));
const router = (0, express_1.Router)();
// Specialized explicit Super Admin protection bypassing JWTs in favor of Infrastructure Secrets
const requireSuperAdmin = (req, res, next) => {
    const secret = req.headers['x-admin-secret'];
    if (!secret || secret !== env_1.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ success: false, error: 'Forbidden: Invalid Admin Secret' });
    }
    next();
};
router.use(requireSuperAdmin);
router.get('/metrics', AdminController.getPlatformMetrics);
router.get('/tenants', AdminController.getAllTenants);
router.patch('/tenants/:id/suspend', AdminController.toggleTenantSuspension);
exports.default = router;
//# sourceMappingURL=admin.routes.js.map