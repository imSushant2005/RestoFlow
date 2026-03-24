"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = exports.sendWhatsAppNotification = void 0;
const twilio_1 = __importDefault(require("twilio"));
const web_push_1 = __importDefault(require("web-push"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const twilioClient = env_1.env.TWILIO_ACCOUNT_SID && env_1.env.TWILIO_AUTH_TOKEN
    ? (0, twilio_1.default)(env_1.env.TWILIO_ACCOUNT_SID, env_1.env.TWILIO_AUTH_TOKEN)
    : null;
if (env_1.env.VAPID_PUBLIC_KEY && env_1.env.VAPID_PRIVATE_KEY) {
    web_push_1.default.setVapidDetails('mailto:support@restoflow.com', env_1.env.VAPID_PUBLIC_KEY, env_1.env.VAPID_PRIVATE_KEY);
}
const sendWhatsAppNotification = async (to, message) => {
    if (!twilioClient || !env_1.env.TWILIO_PHONE_NUMBER) {
        logger_1.logger.debug({ to, message }, 'Twilio not configured. Stubbing WhatsApp notification.');
        return;
    }
    try {
        const formattedNumber = to.startsWith('+') ? to : `+91${to}`; // Defaulting to India
        await twilioClient.messages.create({
            body: message,
            from: `whatsapp:${env_1.env.TWILIO_PHONE_NUMBER}`,
            to: `whatsapp:${formattedNumber}`
        });
        logger_1.logger.info(`WhatsApp sent to ${formattedNumber}`);
    }
    catch (error) {
        logger_1.logger.error({ error, to }, 'Failed to send WhatsApp notification');
    }
};
exports.sendWhatsAppNotification = sendWhatsAppNotification;
const sendPushNotification = async (subscription, payload) => {
    if (!env_1.env.VAPID_PUBLIC_KEY) {
        logger_1.logger.debug({ payload }, 'Web-Push not configured. Stubbing PWA notification.');
        return;
    }
    try {
        await web_push_1.default.sendNotification(subscription, JSON.stringify(payload));
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Failed to send Web-Push notification');
    }
};
exports.sendPushNotification = sendPushNotification;
//# sourceMappingURL=notification.service.js.map