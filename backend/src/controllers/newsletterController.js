const { NewsletterSubscription } = require('../models');
const emailService = require('../services/emailService');
const config = require('../config/env');

const adminRecipients = () =>
  config.resend?.supportRecipients?.length
    ? config.resend.supportRecipients
    : [config.resend?.from || 'admin@sharether.com'];

class NewsletterController {
  async subscribe(req, res) {
    try {
      const { email, source } = req.body || {};
      if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
      }

      const existing = await NewsletterSubscription.findOne({ where: { email } });
      if (existing) {
        if (existing.status !== 'active') {
          existing.status = 'active';
          existing.unsubscribed_at = null;
          if (source) existing.source = source;
          await existing.save();
        }
        return res.json({ success: true, message: 'Already subscribed' });
      }

      await NewsletterSubscription.create({ email, source });

      // Notify admin of new subscriber (fire-and-forget)
      emailService.sendSupportReport({
        to: adminRecipients(),
        subject: 'New newsletter subscriber — Sharether',
        message: `${email} just subscribed to the Sharether newsletter.`,
        reporter: email,
        category: source ? `Newsletter · ${source}` : 'Newsletter',
      }).catch((err) => console.error('Newsletter notify error:', err));

      return res.status(201).json({ success: true, message: 'Subscribed successfully' });
    } catch (error) {
      console.error('Newsletter subscribe error:', error);
      res.status(500).json({ success: false, error: 'Failed to subscribe' });
    }
  }
}

module.exports = new NewsletterController();
