const { Op } = require('sequelize');
const { SupportReport } = require('../models');
const emailService = require('../services/emailService');
const config = require('../config/env');

const SUCCESS_STORY_CATEGORY = 'Success Story';

const normalizeCategory = (value) => {
  const raw = String(value || '').trim();
  if (/^success\s+story$/i.test(raw)) return SUCCESS_STORY_CATEGORY;
  if (/^feedback$/i.test(raw)) return 'Feedback';
  return raw || 'Support';
};

const parseStoryMessage = (message) => {
  const text = String(message || '').trim();
  const collegeMatch = text.match(/^College:\s*(.+?)\n\n([\s\S]*)$/i);
  if (!collegeMatch) {
    return { college: '', story: text };
  }
  return {
    college: collegeMatch[1].trim(),
    story: collegeMatch[2].trim()
  };
};

const storyFromReport = (report) => {
  const { college, story } = parseStoryMessage(report.message);
  const focus = String(report.subject || '')
    .replace(/^Success story submission:\s*/i, '')
    .replace(/^Guest success story:\s*/i, '')
    .trim();
  return {
    id: report.id,
    name: report.name,
    college: college || focus || 'Learnda community',
    focus: focus && focus !== 'Learnda learner' ? focus : (college || 'Learnda learner'),
    story,
    testimony: story,
    achievement: story,
    created_at: report.created_at || report.createdAt
  };
};

class SupportController {
  async submitReport(req, res) {
    try {
      const { name, subject, message, category } = req.body || {};
      const email = String(req.body?.email || '').trim();
      const college = String(req.body?.college || '').trim();
      const normalizedCategory = normalizeCategory(category);
      const isSuccessStory = normalizedCategory === SUCCESS_STORY_CATEGORY;
      const reportEmail = email || (isSuccessStory ? 'success-story@guest.learnda.local' : '');

      if (!name || !reportEmail || !subject || !message) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }

      const reportMessage = isSuccessStory && college
        ? `College: ${college}\n\n${message}`
        : message;
      const report = await SupportReport.create({
        user_id: req.user?.id || null,
        name,
        email: reportEmail,
        subject,
        category: normalizedCategory,
        message: reportMessage
      }, {
        returning: ['id', 'user_id', 'name', 'email', 'subject', 'category', 'message', 'status', 'created_at', 'updated_at']
      });

      let emailDelivery = 'not_configured';
      const recipients = config.resend.supportRecipients.length
        ? config.resend.supportRecipients
        : [];

      if (recipients.length) {
        try {
          await emailService.sendSupportReport({
            to: recipients,
            subject: `Learnda report: ${subject}`,
            message: reportMessage,
            reporter: email ? `${name} (${email})` : (college ? `${name} (${college})` : name),
            category: normalizedCategory
          });
          emailDelivery = 'sent';
        } catch (emailError) {
          emailDelivery = 'failed';
          console.error('Support report email error:', emailError);
        }
      }

      res.status(201).json({
        success: true,
        report_id: report.id,
        email_delivery: emailDelivery
      });
    } catch (error) {
      console.error('Support report error:', error);
      res.status(500).json({ success: false, error: 'Failed to submit report' });
    }
  }

  async listSuccessStories(req, res) {
    try {
      const limit = Math.min(Number.parseInt(req.query?.limit, 10) || 12, 30);
      const reports = await SupportReport.findAll({
        attributes: ['id', 'name', 'subject', 'category', 'message', 'status', 'created_at'],
        where: {
          category: {
            [Op.iLike]: 'success stor%'
          }
        },
        order: [['created_at', 'DESC']],
        limit
      });

      res.json({
        success: true,
        stories: reports.map(storyFromReport)
      });
    } catch (error) {
      console.error('Success stories load error:', error);
      res.status(500).json({ success: false, error: 'Failed to load success stories' });
    }
  }
}

module.exports = new SupportController();
