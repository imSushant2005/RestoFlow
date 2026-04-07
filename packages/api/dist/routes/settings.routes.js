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
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const SettingsController = __importStar(require("../controllers/settings.controller"));
const rbac_1 = require("../constants/rbac");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requireAuth);
router.get('/business', (0, role_middleware_1.requireRoles)(rbac_1.BUSINESS_SETTINGS_READ_ROLES), SettingsController.getBusinessSettings);
router.patch('/business', (0, role_middleware_1.requireRoles)(rbac_1.FULL_ACCESS_ROLES), SettingsController.updateBusinessSettings);
router.get('/staff', (0, role_middleware_1.requireRoles)(rbac_1.FULL_ACCESS_ROLES), SettingsController.getStaff);
router.post('/staff', (0, role_middleware_1.requireRoles)(rbac_1.FULL_ACCESS_ROLES), SettingsController.createStaff);
router.patch('/staff/:id', (0, role_middleware_1.requireRoles)(rbac_1.FULL_ACCESS_ROLES), SettingsController.updateStaff);
router.delete('/staff/:id', (0, role_middleware_1.requireRoles)(rbac_1.FULL_ACCESS_ROLES), SettingsController.deleteStaff);
exports.default = router;
//# sourceMappingURL=settings.routes.js.map