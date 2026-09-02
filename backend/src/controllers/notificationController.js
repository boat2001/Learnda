const { Notification, PushToken } = require('../models');

const EXPO_PUSH_TOKEN_PATTERN = /^Expo(?:nent)?PushToken\[[^\]]+\]$/;

class NotificationController {
  async list(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const requestedLimit = Number.parseInt(req.query?.limit, 10);
      const limit = Math.min(100, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 50));
      const notifications = await Notification.findAll({
        where: { user_id: userId },
        limit,
        order: [['created_at', 'DESC']]
      });

      res.json({ success: true, notifications });
    } catch (error) {
      console.error('List notifications error:', error);
      res.status(500).json({ success: false, error: 'Failed to load notifications' });
    }
  }

  async markAllRead(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      await Notification.update(
        { is_read: true, read_at: new Date() },
        { where: { user_id: userId, is_read: false } }
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Mark all read error:', error);
      res.status(500).json({ success: false, error: 'Failed to update notifications' });
    }
  }

  async markRead(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const notification = await Notification.findOne({
        where: { id, user_id: userId }
      });

      if (!notification) {
        return res.status(404).json({ success: false, error: 'Notification not found' });
      }

      notification.is_read = true;
      notification.read_at = new Date();
      await notification.save();

      res.json({ success: true });
    } catch (error) {
      console.error('Mark read error:', error);
      res.status(500).json({ success: false, error: 'Failed to update notification' });
    }
  }

  async registerPushToken(req, res) {
    try {
      const userId = req.user?.id;
      const { token, platform, device } = req.body || {};

      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const normalizedToken = String(token || '').trim();
      if (!EXPO_PUSH_TOKEN_PATTERN.test(normalizedToken)) {
        return res.status(400).json({ success: false, error: 'A valid Expo push token is required' });
      }

      const existing = await PushToken.findOne({ where: { token: normalizedToken } });
      if (existing) {
        existing.user_id = userId;
        existing.platform = platform || existing.platform;
        existing.device = device || existing.device;
        existing.last_used_at = new Date();
        await existing.save();
        return res.json({ success: true, token: existing });
      }

      const created = await PushToken.create({
        user_id: userId,
        token: normalizedToken,
        platform,
        device,
        last_used_at: new Date()
      });

      res.status(201).json({ success: true, token: created });
    } catch (error) {
      console.error('Register push token error:', error);
      res.status(500).json({ success: false, error: 'Failed to register token' });
    }
  }
}

module.exports = new NotificationController();
