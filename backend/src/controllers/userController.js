const { User } = require('../models');
const { getFileUrl } = require('../config/upload');

const DEFAULT_PREFERENCES = {
  difficulty_level: 'intermediate',
  learning_style: 'visual',
  daily_goal_minutes: 60,
  text_size: 'medium',
  theme: 'auto',
  reduced_motion: false,
  ui_sounds: true,
  show_profile: true,
  show_progress: true,
  email_notifications: true,
  push_notifications: true,
  auto_update_academic_state: true
};

const PREFERENCE_OPTIONS = {
  difficulty_level: ['beginner', 'intermediate', 'advanced'],
  learning_style: ['visual', 'auditory', 'reading', 'kinesthetic'],
  text_size: ['small', 'medium', 'large', 'xlarge'],
  theme: ['light', 'dark', 'auto']
};

const BOOLEAN_PREFERENCES = [
  'reduced_motion',
  'ui_sounds',
  'show_profile',
  'show_progress',
  'email_notifications',
  'push_notifications',
  'auto_update_academic_state'
];

const normalizePreferences = (source = {}) => {
  const existing = source?.settings && typeof source.settings === 'object'
    ? { ...source, ...source.settings }
    : source;

  const normalized = { ...DEFAULT_PREFERENCES };

  Object.entries(PREFERENCE_OPTIONS).forEach(([key, allowed]) => {
    if (allowed.includes(existing?.[key])) {
      normalized[key] = existing[key];
    }
  });

  const goalMinutes = Number(existing?.daily_goal_minutes);
  if (Number.isFinite(goalMinutes)) {
    normalized.daily_goal_minutes = Math.min(240, Math.max(15, Math.round(goalMinutes / 15) * 15));
  }

  BOOLEAN_PREFERENCES.forEach((key) => {
    if (typeof existing?.[key] === 'boolean') {
      normalized[key] = existing[key];
    }
  });

  return normalized;
};

class UserController {
  async getPreferences(req, res) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const prefs = normalizePreferences(user.preferences || {});
      res.json({ success: true, preferences: prefs });
    } catch (error) {
      console.error('Get preferences error:', error);
      res.status(500).json({ success: false, error: 'Failed to load preferences' });
    }
  }

  async updatePreferences(req, res) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const existing = user.preferences && typeof user.preferences === 'object' ? user.preferences : {};
      const settings = normalizePreferences({ ...normalizePreferences(existing), ...(req.body || {}) });
      user.preferences = {
        ...existing,
        ...settings,
        settings
      };
      await user.save();

      res.json({ success: true, preferences: settings });
    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(500).json({ success: false, error: 'Failed to update preferences' });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ success: false, error: 'Current and new passwords are required' });
      }

      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const isValid = await user.verifyPassword(currentPassword);
      if (!isValid) {
        return res.status(400).json({ success: false, error: 'Current password is incorrect' });
      }

      user.password_hash = newPassword;
      await user.save();

      res.json({ success: true, message: 'Password updated' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ success: false, error: 'Failed to change password' });
    }
  }

  async deleteAccount(req, res) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      await user.destroy();
      res.json({ success: true, message: 'Account deleted' });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ success: false, error: 'Failed to delete account' });
    }
  }

  async updateAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Avatar file is required' });
      }

      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const avatarUrl = getFileUrl(req.file);
      user.avatar_url = avatarUrl;
      await user.save();

      res.json({ success: true, avatar_url: avatarUrl });
    } catch (error) {
      console.error('Update avatar error:', error);
      res.status(500).json({ success: false, error: 'Failed to update avatar' });
    }
  }
}

module.exports = new UserController();
