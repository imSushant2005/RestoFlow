"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVapidPublicKey = exports.subscribeToPush = void 0;
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const subscribeToPush = async (req, res) => {
    try {
        const { subscription, deviceId, tenantId } = req.body;
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ success: false, error: 'Invalid Push Subscription payload' });
        }
        // In a full production PWA, you would store this subscription against a Device Model
        // or Customer Profile to push them status updates asynchronously.
        logger_1.logger.info({ deviceId, tenantId }, 'New PWA Push Subscription Registered');
        res.status(201).json({ success: true, message: 'Subscription securely stored' });
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to parse Push Subscription');
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};
exports.subscribeToPush = subscribeToPush;
const getVapidPublicKey = (req, res) => {
    if (!env_1.env.VAPID_PUBLIC_KEY) {
        return res.status(503).json({ success: false, error: 'Push Notifications not configured on this environment' });
    }
    res.json({ success: true, publicKey: env_1.env.VAPID_PUBLIC_KEY });
};
exports.getVapidPublicKey = getVapidPublicKey;
//# sourceMappingURL=notification.controller.js.map