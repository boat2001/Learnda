const rewardService = require('../services/rewardService');

class RewardController {
  async summary(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      const summary = await rewardService.getSummary(userId);
      res.json({ success: true, summary });
    } catch (error) {
      console.error('Reward summary error:', error);
      res.status(500).json({ success: false, error: 'Failed to load rewards' });
    }
  }

  async claim(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { type } = req.body || {};
      if (!type) {
        return res.status(400).json({ success: false, error: 'Reward type is required' });
      }

      const transaction = await rewardService.claimReward(userId, type);
      res.json({ success: true, transaction });
    } catch (error) {
      console.error('Reward claim error:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to claim reward' });
    }
  }

  async transactions(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const transactions = await rewardService.listTransactions(userId);
      res.json({ success: true, transactions });
    } catch (error) {
      console.error('Reward transactions error:', error);
      res.status(500).json({ success: false, error: 'Failed to load transactions' });
    }
  }

  async payouts(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const payouts = await rewardService.listPayouts(userId);
      res.json({ success: true, payouts });
    } catch (error) {
      console.error('Reward payouts error:', error);
      res.status(500).json({ success: false, error: 'Failed to load payouts' });
    }
  }

  async requestPayout(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { destination } = req.body || {};
      const payout = await rewardService.requestPayout(userId, destination);
      res.status(201).json({ success: true, payout });
    } catch (error) {
      console.error('Reward payout error:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to request payout' });
    }
  }

  async setPayoutContact(req, res) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }

      const { contact, telco } = req.body || {};
      if (!contact) {
        return res.status(400).json({ success: false, error: 'Payout contact is required' });
      }

      const data = await rewardService.setPayoutContact(userId, contact, telco);
      res.json({ success: true, data });
    } catch (error) {
      console.error('Set payout contact error:', error);
      res.status(400).json({ success: false, error: error.message || 'Failed to set payout contact' });
    }
  }

  async trackReferralDownload(req, res) {
    try {
      const { referral_code, referralCode, visitor_id, source } = req.body || {};
      const code = referral_code || referralCode;
      if (!code) {
        return res.status(400).json({ success: false, error: 'Referral code is required' });
      }

      const record = await rewardService.trackReferralDownload({
        referralCode: code,
        visitorId: visitor_id || null,
        source: source || null,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      if (!record) {
        return res.status(404).json({ success: false, error: 'Referral code not found' });
      }

      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Track referral download error:', error);
      res.status(500).json({ success: false, error: 'Failed to track referral download' });
    }
  }
}

module.exports = new RewardController();
