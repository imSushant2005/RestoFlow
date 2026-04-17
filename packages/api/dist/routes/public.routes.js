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
const PublicController = __importStar(require("../controllers/public.controller"));
const TableController = __importStar(require("../controllers/table.controller"));
// Lazy-load customer controller at request-time to avoid startup failure
// if the compiled controller file is missing in some build contexts.
const router = (0, express_1.Router)();
// Domain Resolution for White-Label SPA
router.get('/resolve-domain', PublicController.resolveCustomDomain);
// Public Menu (No Auth Required)
router.get('/:tenantSlug/menu', PublicController.getPublicMenu);
router.post('/:tenantSlug/orders', PublicController.createOrder);
router.get('/:tenantSlug/sessions/:sessionToken/orders', PublicController.getSessionOrders);
router.get('/:tenantSlug/orders/:id', PublicController.getOrderInfo);
router.patch('/:tenantSlug/orders/:id/status', PublicController.updateOrderStatusPublic);
router.post('/orders/:id/feedback', PublicController.submitFeedback);
router.post('/:tenantSlug/waiter-call', PublicController.waiterCall);
router.post('/:tenantSlug/waiter-call/acknowledge', PublicController.acknowledgeWaiterCall);
router.post('/tables/:id/session', TableController.createSession);
router.post('/customer/login', async (req, res, next) => {
    try {
        const CustomerController = await import('../controllers/customer.controller.js');
        return CustomerController.login(req, res);
    }
    catch (err) {
        console.error('Customer controller load error:', err);
        return res.status(500).json({ error: 'Customer login unavailable' });
    }
}); // Backward-compatible alias
exports.default = router;
//# sourceMappingURL=public.routes.js.map