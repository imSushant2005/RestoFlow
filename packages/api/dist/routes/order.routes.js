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
const prisma_1 = require("@bhojflow/prisma");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const OrderController = __importStar(require("../controllers/order.controller"));
const rbac_js_1 = require("../constants/rbac.js");
const idempotency_middleware_1 = require("../middlewares/idempotency.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requireAuth);
// router.post('/', requireAuth, requireRoles([UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.WAITER]), OrderController.createOrder); // TODO: implement explicitly
router.get('/assisted/customer-lookup', (0, role_middleware_1.requireRoles)([prisma_1.UserRole.OWNER, prisma_1.UserRole.MANAGER, prisma_1.UserRole.CASHIER, prisma_1.UserRole.WAITER]), OrderController.lookupAssistedCustomer);
router.get('/assisted/summary', (0, role_middleware_1.requireRoles)([prisma_1.UserRole.OWNER, prisma_1.UserRole.MANAGER, prisma_1.UserRole.CASHIER, prisma_1.UserRole.WAITER]), OrderController.getAssistedSummary);
router.post('/assisted', (0, role_middleware_1.requireRoles)([prisma_1.UserRole.OWNER, prisma_1.UserRole.MANAGER, prisma_1.UserRole.CASHIER, prisma_1.UserRole.WAITER]), idempotency_middleware_1.idempotencyMiddleware, OrderController.createAssistedOrder);
router.get('/live', (0, role_middleware_1.requireRoles)(rbac_js_1.ORDER_ACCESS_ROLES), OrderController.getOrders);
router.get('/', (0, role_middleware_1.requireRoles)(rbac_js_1.ORDER_ACCESS_ROLES), OrderController.getOrders); // Fallback until UI migrated
router.get('/history', (0, role_middleware_1.requireRoles)(rbac_js_1.ORDER_HISTORY_ROLES), OrderController.getOrderHistory);
router.get('/:id', (0, role_middleware_1.requireRoles)(rbac_js_1.ORDER_ACCESS_ROLES), OrderController.getOrder);
router.patch('/:id/status', (0, role_middleware_1.requireRoles)(rbac_js_1.ORDER_ACCESS_ROLES), OrderController.updateOrderStatus);
exports.default = router;
//# sourceMappingURL=order.routes.js.map