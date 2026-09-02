const { Op } = require('sequelize');
const { User } = require('../models');
const notificationService = require('./notificationService');
const { sendEngagementEmail } = require('./emailService');
const { sendSms } = require('./smsService');
const {
  getEngagementCta,
  personalizeMessage,
  buildEngagementEmailHtml,
  buildEngagementEmailText,
  buildEngagementSmsText,
} = require('../utils/reengagementContent');

const USER_ATTRS = ['id', 'full_name', 'email', 'phone_number', 'last_active_at', 'role', 'institution_id'];

const isDeliverableEmail = (email) => {
  const value = String(email || '').trim().toLowerCase();
  const placeholder = /^phone\.\d+@auth\.sharether\.(app|local)$/i;
  return Boolean(value && value.includes('@') && !placeholder.test(value) && !value.endsWith('@guest.sharether.local'));
};

const buildLogEntry = (user, message, channelsUsed, prefix, extra = {}) => ({
  id: `${prefix}_${Date.now()}_${user.id}`,
  userId: user.id,
  userName: user.full_name,
  userEmail: user.email,
  name: user.full_name,
  email: user.email,
  phone: user.phone_number,
  message,
  sentAt: new Date().toISOString(),
  channels: channelsUsed,
  status: 'sent',
  ...extra,
});

const deliverEngagementToUser = async (user, {
  notificationType,
  notificationTitle,
  messageTemplate,
  channels,
  ctaLabel,
  ctaPath,
  campaign,
}) => {
  const name = (user.full_name || '').split(' ')[0] || 'there';
  const body = personalizeMessage(messageTemplate, name);
  const ctaUrl = getEngagementCta(ctaPath);
  const label = ctaLabel || 'Open Sharether';
  const title = notificationTitle || 'Sharether';
  const channelsUsed = [];

  if (channels?.push !== false) {
    try {
      await notificationService.createNotification({
        userId: user.id,
        type: notificationType,
        title,
        body,
        action_url: ctaPath || '/pls',
        data: {
          cta_label: label,
          cta_url: ctaUrl,
          campaign: campaign || notificationType,
        },
      });
      channelsUsed.push('push');
    } catch { /* continue */ }
  }

  if (channels?.email && isDeliverableEmail(user.email)) {
    try {
      await sendEngagementEmail(user.email, {
        title,
        name,
        message: messageTemplate,
        ctaLabel: label,
        ctaUrl,
      });
      channelsUsed.push('email');
    } catch { /* continue */ }
  }

  if (channels?.sms && user.phone_number) {
    try {
      await sendSms(
        user.phone_number,
        buildEngagementSmsText({ title, name, message: messageTemplate, ctaLabel: label, ctaUrl })
      );
      channelsUsed.push('sms');
    } catch { /* continue */ }
  }

  return { body, channelsUsed };
};

const resolveEngagementRecipients = async ({
  targetMode,
  userIds,
  group,
  inactivityDays,
  sentIds = new Set(),
}) => {
  const mode = String(targetMode || 'inactive').trim();

  if (mode === 'selected') {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : []).map((id) => String(id).trim()).filter(Boolean))];
    if (!ids.length) {
      return { users: [], error: 'Select at least one user.' };
    }
    const users = await User.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: USER_ATTRS,
    });
    return { users, error: users.length ? null : 'No matching users found for the selected IDs.' };
  }

  if (mode === 'group') {
    const groupType = String(group?.type || '').trim();
    const where = {};

    if (groupType === 'role') {
      where.role = String(group?.role || 'student').trim();
    } else if (groupType === 'institution') {
      const institutionId = String(group?.institutionId || '').trim();
      if (!institutionId) {
        return { users: [], error: 'Choose a college for this group.' };
      }
      where.institution_id = institutionId;
      where.role = 'student';
    } else if (groupType === 'inactive') {
      const cutoff = new Date(Date.now() - inactivityDays * 24 * 60 * 60 * 1000);
      where.last_active_at = { [Op.lt]: cutoff };
    } else {
      return { users: [], error: 'Choose a valid group type.' };
    }

    const users = await User.findAll({
      where,
      attributes: USER_ATTRS,
      limit: 500,
      order: [['last_active_at', 'ASC']],
    });
    const filtered = users.filter((user) => !sentIds.has(user.id));
    return { users: filtered, error: null, totalBeforeFilter: users.length };
  }

  const cutoff = new Date(Date.now() - inactivityDays * 24 * 60 * 60 * 1000);
  const inactiveUsers = await User.findAll({
    where: { last_active_at: { [Op.lt]: cutoff } },
    attributes: USER_ATTRS,
    limit: 500,
    order: [['last_active_at', 'ASC']],
  });
  const filtered = inactiveUsers.filter((user) => !sentIds.has(user.id));
  return { users: filtered, error: null, totalBeforeFilter: inactiveUsers.length };
};

module.exports = {
  deliverEngagementToUser,
  resolveEngagementRecipients,
  buildLogEntry,
  isDeliverableEmail,
};
