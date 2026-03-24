import twilio from 'twilio';
import webpush from 'web-push';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const twilioClient = env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
  ? twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
  : null;

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:support@restoflow.com',
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY
  );
}

export const sendWhatsAppNotification = async (to: string, message: string) => {
  if (!twilioClient || !env.TWILIO_PHONE_NUMBER) {
    logger.debug({ to, message }, 'Twilio not configured. Stubbing WhatsApp notification.');
    return;
  }
  try {
    const formattedNumber = to.startsWith('+') ? to : `+91${to}`; // Defaulting to India
    await twilioClient.messages.create({
      body: message,
      from: `whatsapp:${env.TWILIO_PHONE_NUMBER}`,
      to: `whatsapp:${formattedNumber}`
    });
    logger.info(`WhatsApp sent to ${formattedNumber}`);
  } catch (error) {
    logger.error({ error, to }, 'Failed to send WhatsApp notification');
  }
};

export const sendPushNotification = async (subscription: webpush.PushSubscription, payload: any) => {
  if (!env.VAPID_PUBLIC_KEY) {
    logger.debug({ payload }, 'Web-Push not configured. Stubbing PWA notification.');
    return;
  }
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error) {
    logger.error({ error }, 'Failed to send Web-Push notification');
  }
};
