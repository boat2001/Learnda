const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const { authenticate, checkRole } = require('../middleware/auth');
const { requireAdminPermission, auditAdminAction } = require('../utils/adminAccess');
const { optionalAuth } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

const DATA_FILE       = path.join(__dirname, '../data/applications.json');
const TEAM_LINKS_FILE = path.join(__dirname, '../data/team_links.json');

const VALID_TYPES = ['contributor', 'ambassador', 'developer', 'designer', 'other'];

const TYPE_LABEL = {
  contributor: 'Contributor',
  ambassador:  'Campus Ambassador',
  developer:   'Developer',
  designer:    'Designer',
  other:       'Team Member',
};

function loadApplications() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch { return []; }
}

function saveApplications(apps) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(apps, null, 2));
}

function loadTeamLinks() {
  try {
    if (!fs.existsSync(TEAM_LINKS_FILE)) return {};
    return JSON.parse(fs.readFileSync(TEAM_LINKS_FILE, 'utf8'));
  } catch { return {}; }
}

async function sendWhatsAppInviteEmail(app, whatsappLink) {
  if (!app.email || !whatsappLink) return;
  const role = TYPE_LABEL[app.type] || 'Team Member';
  const firstName = (app.name || '').split(' ')[0] || 'there';
  const subject = `Welcome to the Sharether ${role} team! 🎉`;
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#1f7177;padding:20px 32px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:middle;padding-right:12px;">
                <img src="https://pub-1dec8067cfda47ef9b8088c56989e07e.r2.dev/brand/sharether-logo.png" alt="Sharether" width="40" height="40" style="display:block;border-radius:8px;" />
              </td>
              <td style="vertical-align:middle;">
                <span style="font-size:20px;font-weight:700;color:#ffffff;">Sharether</span>
              </td>
            </tr></table>
          </td>
        </tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">Congratulations, ${firstName}! 🎉</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">
            Your application to join the Sharether team as a <strong>${role}</strong> has been approved.
            We're excited to have you on board!
          </p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#374151;">
            The next step is to join our ${role} WhatsApp group, where you'll get updates, connect with the team, and receive your first tasks.
          </p>
          <a href="${whatsappLink}" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:700;">
            Join the WhatsApp Group
          </a>
          <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
            Welcome to the team. We can't wait to build something great together.
          </p>
        </td></tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} Sharether &bull;
              <a href="https://beta.sharether.com" style="color:#1f7177;text-decoration:none;">sharether.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({ to: app.email, subject, html,
    text: `Congratulations ${firstName}! Your ${role} application has been approved. Join the team WhatsApp group here: ${whatsappLink}` });
}

// ── Public: submit an application ────────────────────────────────────────────
router.post('/', optionalAuth, (req, res) => {
  try {
    const { type, name, email, phone, message, portfolio, skills, motivation } = req.body;

    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid application type.' });
    }
    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'Name and email are required.' });
    }

    const apps = loadApplications();
    const newApp = {
      id: `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      name,
      email,
      phone: phone || null,
      message: message || null,
      portfolio: portfolio || null,
      skills: skills || null,
      motivation: motivation || null,
      userId: req.user?.id || null,
      status: 'pending',
      adminNote: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
      whatsappInviteSent: false,
      whatsappInviteSentAt: null,
    };

    apps.unshift(newApp);
    saveApplications(apps);
    res.json({ success: true, application: newApp });
  } catch (error) {
    console.error('Application submit error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit application.' });
  }
});

// ── Admin: list applications ──────────────────────────────────────────────────
router.get('/admin', authenticate, checkRole(['admin']), requireAdminPermission('applications'), (req, res) => {
  try {
    const { type, status, limit = 50, offset = 0 } = req.query;
    let apps = loadApplications();

    if (type && type !== 'all')     apps = apps.filter((a) => a.type === type);
    if (status && status !== 'all') apps = apps.filter((a) => a.status === status);

    const total = apps.length;
    const page  = apps.slice(Number(offset), Number(offset) + Number(limit));
    res.json({ success: true, applications: page, total });
  } catch (error) {
    console.error('Applications list error:', error);
    res.status(500).json({ success: false, error: 'Failed to load applications.' });
  }
});

// ── Admin: review an application ─────────────────────────────────────────────
router.patch('/admin/:id', authenticate, checkRole(['admin']), requireAdminPermission('applications'), auditAdminAction('review_application', 'applications'), async (req, res) => {
  try {
    const { status, adminNote, whatsappLink, sendInvite } = req.body;
    const VALID = ['pending', 'approved', 'rejected', 'interviewing'];
    if (!VALID.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status.' });
    }

    const apps = loadApplications();
    const idx  = apps.findIndex((a) => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ success: false, error: 'Application not found.' });

    const prev = apps[idx];
    const wasApproved = prev.status === 'approved';
    const nowApproved = status === 'approved';

    apps[idx] = {
      ...prev,
      status,
      adminNote: adminNote ?? prev.adminNote,
      reviewedAt: new Date().toISOString(),
    };

    // Send WhatsApp invite email when newly approved (or when admin explicitly requests it)
    let inviteSent = false;
    if (apps[idx].email && (sendInvite === true || (nowApproved && !wasApproved))) {
      const resolvedLink = whatsappLink
        || (loadTeamLinks()[apps[idx].type]?.whatsapp || '');

      if (resolvedLink) {
        try {
          await sendWhatsAppInviteEmail(apps[idx], resolvedLink);
          apps[idx].whatsappInviteSent = true;
          apps[idx].whatsappInviteSentAt = new Date().toISOString();
          apps[idx].whatsappInviteLink   = resolvedLink;
          inviteSent = true;
        } catch (emailErr) {
          console.error('WhatsApp invite email error:', emailErr);
        }
      }
    }

    saveApplications(apps);
    res.json({ success: true, application: apps[idx], inviteSent });
  } catch (error) {
    console.error('Application review error:', error);
    res.status(500).json({ success: false, error: 'Failed to update application.' });
  }
});

module.exports = router;
