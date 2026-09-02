const express = require('express');
const path = require('path');
const fs = require('fs');
const { User } = require('../models');
const authController = require('../controllers/authController');

const router = express.Router();

const INVITES_FILE = path.join(__dirname, '../data/lecturer_invites.json');

function loadInvites() {
  try {
    if (!fs.existsSync(INVITES_FILE)) return [];
    return JSON.parse(fs.readFileSync(INVITES_FILE, 'utf8'));
  } catch { return []; }
}
function saveInvites(invites) {
  const dir = path.dirname(INVITES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(INVITES_FILE, JSON.stringify(invites, null, 2));
}

// GET /api/lecturer-invite/:token — validate token, return invite info
router.get('/:token', (req, res) => {
  const invites = loadInvites();
  const invite = invites.find((i) => i.token === req.params.token);
  if (!invite) return res.status(404).json({ success: false, error: 'Invalid or expired invitation link.' });
  if (invite.status === 'completed') return res.status(410).json({ success: false, error: 'This invitation has already been used.' });
  if (invite.status === 'revoked') return res.status(410).json({ success: false, error: 'This invitation has been revoked.' });
  if (new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ success: false, error: 'This invitation link has expired. Please ask the admin to send a new one.' });
  }
  res.json({
    success: true,
    contact: invite.contact,
    contact_type: invite.contact_type,
    expires_at: invite.expires_at,
  });
});

// POST /api/lecturer-invite/:token/complete — submit form, create account
router.post('/:token/complete', async (req, res) => {
  const invites = loadInvites();
  const idx = invites.findIndex((i) => i.token === req.params.token);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Invalid invitation link.' });
  const invite = invites[idx];
  if (invite.status !== 'pending') return res.status(410).json({ success: false, error: 'This invitation has already been used or revoked.' });
  if (new Date(invite.expires_at) < new Date()) return res.status(410).json({ success: false, error: 'Invitation link has expired.' });

  const {
    first_name, last_name, email, phone,
    college, department, specialty_courses,
    highest_qualification,
    payout_channel, payout_network, payout_account,
    payout_bank, payout_bank_branch, payout_account_name,
    password,
  } = req.body;

  if (!first_name?.trim() || !last_name?.trim()) {
    return res.status(400).json({ success: false, error: 'First and last name are required.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
  }

  const resolvedEmail = invite.contact_type === 'email' ? invite.contact : email?.trim();
  const resolvedPhone = invite.contact_type === 'phone' ? invite.contact : phone?.trim();

  if (!resolvedEmail) {
    return res.status(400).json({ success: false, error: 'Email address is required.' });
  }

  try {
    const lecturerPrefs = {
      college: college?.trim() || '',
      department: department?.trim() || '',
      specialty_courses: Array.isArray(specialty_courses)
        ? specialty_courses
        : String(specialty_courses || '').split(',').map((s) => s.trim()).filter(Boolean),
      highest_qualification: highest_qualification?.trim() || '',
      payout_channel: payout_channel || 'momo',
      payout_network: payout_network?.trim() || '',
      payout_bank: payout_bank?.trim() || '',
      payout_bank_branch: payout_bank_branch?.trim() || '',
      payout_account_name: payout_account_name?.trim() || '',
    };

    let user = await User.findOne({ where: { email: resolvedEmail } });

    if (user) {
      // Existing user — upgrade to lecturer
      await user.update({
        role: 'lecturer',
        full_name: `${first_name.trim()} ${last_name.trim()}`,
        phone_number: resolvedPhone || user.phone_number,
        institution: college?.trim() || user.institution,
        affiliate_university: college?.trim() || user.affiliate_university,
        program: department?.trim() || user.program,
        profile_complete: true,
        onboarding_step: 'DONE',
        email_verified: true,
        preferences: { ...(user.preferences || {}), lecturer: lecturerPrefs },
        payout_contact: payout_account?.trim() || user.payout_contact,
        payout_telco: payout_channel === 'bank' ? 'bank' : (payout_network?.trim() || user.payout_telco),
      });
    } else {
      // New user
      user = await User.create({
        full_name: `${first_name.trim()} ${last_name.trim()}`,
        email: resolvedEmail,
        phone_number: resolvedPhone || null,
        password_hash: password,
        role: 'lecturer',
        profile_complete: true,
        onboarding_step: 'DONE',
        email_verified: true,
        institution: college?.trim() || null,
        affiliate_university: college?.trim() || null,
        program: department?.trim() || null,
        preferences: { lecturer: lecturerPrefs },
        payout_contact: payout_account?.trim() || null,
        payout_telco: payout_channel === 'bank' ? 'bank' : (payout_network?.trim() || null),
      });
    }

    // Mark invite completed
    invites[idx] = { ...invite, status: 'completed', completed_at: new Date().toISOString(), completed_by_user_id: user.id };
    saveInvites(invites);

    // Issue auth tokens so the lecturer lands logged in
    const context = await authController.loadAuthContext(user);
    const accessToken = authController.generateToken(user);
    const refreshToken = authController.generateRefreshToken(user);

    res.json({
      success: true,
      accessToken,
      token: accessToken,
      refreshToken,
      user: authController.buildAuthUser(user, context),
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }
    console.error('Lecturer invite complete error:', error);
    res.status(500).json({ success: false, error: 'Failed to create account. Please try again.' });
  }
});

module.exports = router;
