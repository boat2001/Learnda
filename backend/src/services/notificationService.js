const { Notification, PushToken } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');
const { sendPushNotifications } = require('./pushNotificationService');

const WELCOME_NOTIFICATION_TYPE = 'welcome_signup';
const WELCOME_NOTIFICATION_BODY = 'Take lessons, practice past questions, join study groups, view and download files, and edutain yourself. Just feel at home. \u{1F44C}';

function getFirstName(user) {
  const name = String(user?.full_name || user?.name || '').trim();
  return name ? name.split(/\s+/)[0] : 'there';
}

async function createNotification({ userId = null, title, body, type, action_url, data = {} }) {
  const notification = await Notification.create({
    user_id: userId,
    title,
    body,
    type,
    action_url,
    data
  });

  if (userId) {
    const tokens = await PushToken.findAll({ where: { user_id: userId } });
    const expoTokens = tokens.map((t) => t.token).filter(Boolean);
    if (expoTokens.length) {
      try {
        const result = await sendPushNotifications(
          expoTokens.map((token) => ({
            to: token,
            title,
            body,
            sound: 'default',
            channelId: 'default',
            data: {
              ...data,
              notification_id: notification.id,
              action_url: action_url || null
            }
          }))
        );

        if (result.invalidTokens?.length) {
          await PushToken.destroy({ where: { token: { [Op.in]: result.invalidTokens } } });
        }
        if (result.errors?.length) {
          logger.warn(`Expo rejected ${result.errors.length} push notification(s)`);
        }
      } catch (error) {
        // The in-app notification is already stored. A temporary Expo outage
        // must not make the notification-producing action fail.
        logger.warn(`Push delivery failed: ${error.message}`);
      }
    }
  }

  return notification;
}

async function createWelcomeNotification(user) {
  if (!user?.id) return null;

  const existing = await Notification.findOne({
    where: {
      user_id: user.id,
      type: WELCOME_NOTIFICATION_TYPE
    }
  });
  if (existing) return existing;

  const firstName = getFirstName(user);
  return createNotification({
    userId: user.id,
    title: 'Welcome to Sharether v3.0',
    body: WELCOME_NOTIFICATION_BODY,
    type: WELCOME_NOTIFICATION_TYPE,
    action_url: '/',
    data: {
      display: 'modal',
      first_name: firstName
    }
  });
}

module.exports = {
  createNotification,
  createWelcomeNotification,
  WELCOME_NOTIFICATION_TYPE
};
