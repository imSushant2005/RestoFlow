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
const prisma_1 = require("@bhojflow/prisma");
const MenuController = __importStar(require("../controllers/menu.controller"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requireAuth);
router.get('/categories', MenuController.getCategories);
router.post('/categories', (0, role_middleware_1.requireRoles)([prisma_1.UserRole.OWNER, prisma_1.UserRole.MANAGER]), MenuController.createCategory);
router.put('/categories/reorder', (0, role_middleware_1.requireRoles)([prisma_1.UserRole.OWNER, prisma_1.UserRole.MANAGER]), MenuController.reorderCategories);
router.get('/items', MenuController.getMenuItems);
router.post('/items', (0, role_middleware_1.requireRoles)([prisma_1.UserRole.OWNER, prisma_1.UserRole.MANAGER]), MenuController.createMenuItem);
router.put('/items/reorder', (0, role_middleware_1.requireRoles)([prisma_1.UserRole.OWNER, prisma_1.UserRole.MANAGER]), MenuController.reorderMenuItems);
router.patch('/items/bulk-availability', (0, role_middleware_1.requireRoles)([prisma_1.UserRole.OWNER, prisma_1.UserRole.MANAGER]), MenuController.bulkUpdateAvailability);
router.patch('/items/:id', (0, role_middleware_1.requireRoles)([prisma_1.UserRole.OWNER, prisma_1.UserRole.MANAGER]), MenuController.updateMenuItem);
router.patch('/items/:id/availability', (0, role_middleware_1.requireRoles)([prisma_1.UserRole.OWNER, prisma_1.UserRole.MANAGER, prisma_1.UserRole.CASHIER, prisma_1.UserRole.WAITER, prisma_1.UserRole.KITCHEN]), MenuController.toggleItemAvailability);
router.post('/bulk-import', (0, role_middleware_1.requireRoles)([prisma_1.UserRole.OWNER, prisma_1.UserRole.MANAGER]), MenuController.bulkImportMenu);
exports.default = router;
//# sourceMappingURL=menu.routes.js.map