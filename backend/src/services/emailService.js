const { Resend } = require('resend');
const logger = require('../config/logger');
const config = require('../config/env');
const {
  buildEngagementEmailHtml,
  buildEngagementEmailText,
} = require('../utils/reengagementContent');

let client = null;

const isConfigured = () => Boolean(config.resend?.apiKey);

const getClient = () => {
  if (!isConfigured()) return null;
  if (!client) client = new Resend(config.resend.apiKey);
  return client;
};

const from = () => config.resend?.from || 'Learnda <noreply@learnda.app>';

const logSkipped = (type, details = {}) =>
  logger.info(`Email service not configured. Skipping ${type} email.`, details);

const sendEmail = async ({ to, subject, text, html, replyTo }) => {
  const resend = getClient();
  if (!resend) {
    logSkipped('generic', { to, subject });
    return { success: true, skipped: true };
  }

  const payload = { from: from(), to, subject };
  if (html) payload.html = html;
  if (text) payload.text = text;
  if (replyTo) payload.replyTo = replyTo;

  const { data, error } = await resend.emails.send(payload);
  if (error) throw new Error(error.message || 'Resend delivery failed');
  return { success: true, messageId: data?.id };
};

// ── Shared HTML helpers ────────────────────────────────────────────────────────

const BRAND_NAME = 'Learnda Learning Platform';
const SITE_URL = process.env.APP_PUBLIC_URL || 'https://beta.learnda.app';
// Absolute URL required: email clients cannot resolve app-relative paths.
const LOGO_URL = process.env.BRAND_LOGO_URL
  || (process.env.R2_PUBLIC_URL ? `${process.env.R2_PUBLIC_URL}/brand/learnda-logo.png` : `${SITE_URL}/learnda-logo.png`);

const wrap = (bodyContent) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#1f56db;padding:20px 32px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;padding-right:12px;">
                  <img src="${LOGO_URL}" alt="${BRAND_NAME} logo" width="40" height="40"
                    style="display:block;border-radius:8px;border:0;" />
                </td>
                <td style="vertical-align:middle;">
                  <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.4px;">${BRAND_NAME}</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="padding:32px;">${bodyContent}</td></tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${new Date().getFullYear()} ${BRAND_NAME} &bull;
              <a href="${SITE_URL}" style="color:#1f56db;text-decoration:none;">learnda.app</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const otpBlock = (otp) => `
  <div style="margin:24px 0;text-align:center;">
    <span style="display:inline-block;background:#f0fafa;border:2px dashed #1f56db;border-radius:8px;padding:14px 32px;font-size:32px;font-weight:700;letter-spacing:8px;color:#1f56db;">${otp}</span>
  </div>`;

const p = (text, style = '') =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;${style}">${text}</p>`;

const h1 = (text) =>
  `<h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111827;">${text}</h1>`;

const muted = (text) =>
  `<p style="margin:16px 0 0;font-size:13px;color:#9ca3af;">${text}</p>`;

// ── Email senders ──────────────────────────────────────────────────────────────

module.exports = {
  isConfigured,
  sendEmail,
  LOGO_URL,
  SITE_URL,

  sendWelcomeEmail: async (email, fullName) => {
    if (!isConfigured()) { logSkipped('welcome', { email }); return { success: true, skipped: true }; }
    const name = fullName || 'there';
    return sendEmail({
      to: email,
      subject: 'Welcome to Learnda!',
      text: `Hi ${name}, welcome to Learnda! We're glad you're here. Start exploring courses and study resources at ${SITE_URL}.`,
      html: wrap(`
        ${h1(`Welcome, ${name}! 🎉`)}
        ${p('You\'ve successfully joined Learnda — the smarter way to learn.')}
        ${p('Explore courses, study resources, and personalised learning tools tailored to your programme.')}
        <a href="${SITE_URL}" style="display:inline-block;margin-top:8px;background:#1f56db;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">Get started</a>
        ${muted('If you did not create an account, you can safely ignore this email.')}
      `),
    });
  },

  sendVerificationEmail: async (email, token) => {
    if (!isConfigured()) { logSkipped('verification', { email }); return { success: true, skipped: true }; }
    return sendEmail({
      to: email,
      subject: 'Verify your Learnda account',
      text: `Use this token to verify your account: ${token}`,
      html: wrap(`
        ${h1('Verify your account')}
        ${p('Use the link below to verify your Learnda account:')}
        <a href="${token}" style="display:inline-block;margin:8px 0 16px;background:#1f56db;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">Verify account</a>
        ${muted('If you did not request this, ignore this email.')}
      `),
    });
  },

  sendPasswordResetEmail: async (email, resetUrl) => {
    if (!isConfigured()) { logSkipped('password_reset', { email }); return { success: true, skipped: true }; }
    return sendEmail({
      to: email,
      subject: 'Reset your Learnda password',
      text: `Click here to reset your password: ${resetUrl}. This link expires in 1 hour.`,
      html: wrap(`
        ${h1('Reset your password')}
        ${p('We received a request to reset your Learnda password. Click the button below to choose a new one.')}
        <a href="${resetUrl}" style="display:inline-block;margin:8px 0 16px;background:#1f56db;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">Reset password</a>
        ${p('This link expires in <strong>1 hour</strong>.', 'font-size:13px;color:#6b7280;')}
        ${muted('If you did not request a password reset, ignore this email — your account is safe.')}
      `),
    });
  },

  sendPasswordResetOtpEmail: async (email, otp, expiresInMinutes = 10) => {
    if (!isConfigured()) { logSkipped('password_reset_otp', { email }); return { success: true, skipped: true }; }
    return sendEmail({
      to: email,
      subject: 'Your Learnda password reset code',
      text: `Your password reset code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
      html: wrap(`
        ${h1('Password reset code')}
        ${p('Use the code below to reset your Learnda password:')}
        ${otpBlock(otp)}
        ${p(`This code expires in <strong>${expiresInMinutes} minutes</strong>.`, 'font-size:13px;color:#6b7280;')}
        ${muted('If you did not request a password reset, ignore this email.')}
      `),
    });
  },

  sendRegistrationOtpEmail: async (email, otp, expiresInMinutes = 10) => {
    if (!isConfigured()) { logSkipped('register_otp', { email }); return { success: true, skipped: true }; }
    return sendEmail({
      to: email,
      subject: 'Verify your Learnda email',
      text: `Your Learnda verification code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
      html: wrap(`
        ${h1('Verify your email')}
        ${p('Enter this code to complete your Learnda registration:')}
        ${otpBlock(otp)}
        ${p(`This code expires in <strong>${expiresInMinutes} minutes</strong>.`, 'font-size:13px;color:#6b7280;')}
        ${muted('If you did not create an account, ignore this email.')}
      `),
    });
  },

  sendSubscriptionConfirmation: async (email, planId, transactionId) => {
    if (!isConfigured()) { logSkipped('subscription_confirmation', { email }); return { success: true, skipped: true }; }
    return sendEmail({
      to: email,
      subject: 'Subscription confirmed — Learnda',
      text: `Your Learnda subscription is active. Plan: ${planId}. Transaction: ${transactionId}.`,
      html: wrap(`
        ${h1('Subscription confirmed ✓')}
        ${p('Your Learnda subscription is now active. You have full access to all content on your plan.')}
        ${p(`<strong>Plan:</strong> ${planId}<br/><strong>Transaction:</strong> ${transactionId}`)}
        <a href="${SITE_URL}" style="display:inline-block;margin-top:8px;background:#1f56db;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">Start learning</a>
      `),
    });
  },

  sendSubscriptionCancellation: async (email, planName) => {
    if (!isConfigured()) { logSkipped('subscription_cancellation', { email }); return { success: true, skipped: true }; }
    return sendEmail({
      to: email,
      subject: 'Subscription cancelled — Learnda',
      text: `Your Learnda subscription (${planName}) has been cancelled.`,
      html: wrap(`
        ${h1('Subscription cancelled')}
        ${p(`Your <strong>${planName}</strong> subscription has been cancelled. You will retain access until the end of your current billing period.`)}
        ${p('We\'d love to have you back. You can resubscribe at any time.')}
        <a href="${SITE_URL}" style="display:inline-block;margin-top:8px;background:#1f56db;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">View Plans</a>
      `),
    });
  },

  sendSubscriptionExpired: async (email, planId) => {
    if (!isConfigured()) { logSkipped('subscription_expired', { email }); return { success: true, skipped: true }; }
    return sendEmail({
      to: email,
      subject: 'Your Learnda subscription has expired',
      text: `Your Learnda subscription (${planId}) has expired. Please renew to keep access.`,
      html: wrap(`
        ${h1('Your subscription has expired')}
        ${p(`Your <strong>${planId}</strong> subscription has expired. Renew now to keep access to all your courses and study materials.`)}
        <a href="${SITE_URL}" style="display:inline-block;margin-top:8px;background:#1f56db;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">Renew subscription</a>
      `),
    });
  },

  sendEngagementEmail: async (email, { title, name, message, ctaLabel, ctaUrl }) => {
    if (!isConfigured()) {
      logSkipped('engagement', { email });
      return { success: true, skipped: true };
    }
    const firstName = String(name || 'there').trim() || 'there';
    const subject = String(title || 'Learnda').trim() || 'Learnda';
    const payload = { title: subject, name: firstName, message, ctaLabel, ctaUrl };
    return sendEmail({
      to: email,
      subject,
      text: buildEngagementEmailText(payload),
      html: wrap(buildEngagementEmailHtml(payload)),
    });
  },

  sendLearningReminderEmail: async (email, payload) =>
    module.exports.sendEngagementEmail(email, {
      ...payload,
      title: payload?.title || 'Learnda missing you',
    }),

  sendSupportReport: async ({ to, subject, message, reporter, category }) => {
    if (!isConfigured()) { logSkipped('support_report', { to }); return { success: true, skipped: true }; }
    const lines = [
      reporter ? `<strong>Reporter:</strong> ${reporter}` : null,
      category ? `<strong>Category:</strong> ${category}` : null,
    ].filter(Boolean).join('<br/>');
    return sendEmail({
      to,
      subject,
      text: `${reporter ? `Reporter: ${reporter}\n` : ''}${category ? `Category: ${category}\n` : ''}\n${message}`,
      html: wrap(`
        ${h1(subject)}
        ${lines ? p(lines) : ''}
        <div style="background:#f9fafb;border-left:4px solid #1f56db;border-radius:4px;padding:16px;margin-top:8px;">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#374151;white-space:pre-wrap;">${message}</p>
        </div>
      `),
    });
  },
};
