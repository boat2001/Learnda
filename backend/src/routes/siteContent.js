const express = require('express');
const fs = require('fs');
const path = require('path');
const { authenticate, checkRole } = require('../middleware/auth');
const { requireAdminPermission, auditAdminAction } = require('../utils/adminAccess');

const router = express.Router();
const DATA_FILE = path.join(__dirname, '../data/site_content.json');

const DEFAULT_CONTENT = {
  // Learnda ships with no default roster. The forked platform's team data (real names, photos,
  // personal social accounts, COE donor testimonials) was removed per dev guide §10 / §11.
  team: {
    core_team: [],
    content_support: [],
    notable_mentions: [],
    donors: [],
  },
  updates: [
    { id: 'upd-1', title: 'PLS folders get smarter', date: 'Nov 14, 2025', tag: 'Product', summary: 'Organize your files with quick labels and recent activity.' },
    { id: 'upd-2', title: 'New exam sprint mode', date: 'Nov 07, 2025', tag: 'Practice', summary: 'Timed sessions now save your progress and reset weekly.' },
    { id: 'upd-3', title: 'Contributor payouts', date: 'Oct 29, 2025', tag: 'Creators', summary: 'Track revenue shares, withdrawals, and earnings history.' },
    { id: 'upd-4', title: 'Community mentorship rooms', date: 'Oct 18, 2025', tag: 'Community', summary: 'Join mentor-led rooms for weekly review sessions.' },
  ],
};

function loadContent() {
  const mergeById = (defaultItems = [], savedItems = []) => {
    const defaultMap = new Map(defaultItems.map((item) => [String(item?.id || ''), item]));
    const savedMap = new Map(savedItems.map((item) => [String(item?.id || ''), item]));
    const orderedIds = [
      ...defaultItems.map((item) => String(item?.id || '')),
      ...savedItems
        .map((item) => String(item?.id || ''))
        .filter((id) => id && !defaultMap.has(id)),
    ];

    return orderedIds
      .filter(Boolean)
      .map((id) => {
        const base = defaultMap.get(id) || {};
        const override = savedMap.get(id) || {};
        return {
          ...base,
          ...override,
          contact: { ...(base.contact || {}), ...(override.contact || {}) },
          social: { ...(base.social || {}), ...(override.social || {}) },
          bio: Array.isArray(override.bio)
            ? override.bio
            : (Array.isArray(base.bio) ? base.bio : []),
        };
      });
  };

  const mergeTeamWithDefaults = (savedTeam = {}) => {
    const defaultTeam = DEFAULT_CONTENT.team || {};
    return {
      ...defaultTeam,
      ...savedTeam,
      core_team: mergeById(defaultTeam.core_team || [], savedTeam.core_team || []),
      content_support: mergeById(defaultTeam.content_support || [], savedTeam.content_support || []),
      notable_mentions: mergeById(defaultTeam.notable_mentions || [], savedTeam.notable_mentions || []),
      donors: mergeById(defaultTeam.donors || [], savedTeam.donors || []),
    };
  };

  try {
    if (!fs.existsSync(DATA_FILE)) return DEFAULT_CONTENT;
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      team: mergeTeamWithDefaults(parsed.team || {}),
      updates: Array.isArray(parsed.updates) ? parsed.updates : DEFAULT_CONTENT.updates,
    };
  } catch {
    return DEFAULT_CONTENT;
  }
}

function saveContent(content) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(content, null, 2));
}

router.get('/team', (_req, res) => res.json({ success: true, team: loadContent().team }));
router.get('/updates', (_req, res) => res.json({ success: true, updates: loadContent().updates }));

router.get('/admin', authenticate, checkRole(['admin']), requireAdminPermission('publishing'), (_req, res) => {
  res.json({ success: true, content: loadContent() });
});

router.put('/admin/:key', authenticate, checkRole(['admin']), requireAdminPermission('publishing'), auditAdminAction('update_site_content', 'publishing'), (req, res) => {
  const { key } = req.params;
  if (!['team', 'updates'].includes(key)) {
    return res.status(400).json({ success: false, error: 'Unsupported site content key.' });
  }
  const content = loadContent();
  content[key] = req.body?.value;
  saveContent(content);
  res.json({ success: true, value: content[key] });
});

module.exports = router;
