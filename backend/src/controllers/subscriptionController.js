// src/controllers/subscriptionController.js
const { Subscription, PaymentTransaction, Plan } = require('../models');
const subscriptionService = require('../services/subscriptionService');

module.exports = {
  async getPlans(req, res) {
    const plans = await subscriptionService.getAllPlans();
    res.json({ success: true, plans });
  },

  async getCurrent(req, res) {
    const plan = await subscriptionService.getUserPlan(req.user.id);
    res.json({ success: true, plan });
  },

  async getInvoices(req, res) {
    try {
      const limitRaw = Number.parseInt(req.query?.limit, 10);
      const limit = Number.isFinite(limitRaw)
        ? Math.min(Math.max(limitRaw, 1), 100)
        : 25;

      const invoices = await PaymentTransaction.findAll({
        where: { user_id: req.user.id, status: 'success' },
        include: [
          {
            model: Plan,
            as: 'plan',
            attributes: ['id', 'name', 'price', 'billing_cycle']
          }
        ],
        order: [['paid_at', 'DESC'], ['created_at', 'DESC']],
        limit
      });

      res.json({
        success: true,
        invoices: invoices.map((invoice) => ({
          id: invoice.id,
          plan_id: invoice.plan_id,
          plan_name: invoice.plan?.name || null,
          amount: Number(invoice.amount || 0),
          currency: invoice.currency || 'GHS',
          duration_months: Number(invoice.metadata?.duration_months || invoice.metadata?.durationMonths || 1),
          provider: invoice.provider || null,
          status: invoice.status,
          reference: invoice.transaction_reference,
          provider_transaction_id: invoice.provider_transaction_id || null,
          paid_at: invoice.paid_at || invoice.created_at,
          created_at: invoice.created_at
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to load invoices'
      });
    }
  },

  async getPaymentMethods(req, res) {
    res.json({ success: true, payment_methods: [] });
  },

  async addPaymentMethod(req, res) {
    const paymentMethod = req.body || {};
    res.status(201).json({ success: true, payment_method: paymentMethod });
  },

  async removePaymentMethod(req, res) {
    res.json({ success: true });
  },

  async subscribe(req, res) {
    const { planId, paymentMethod = null, paymentDetails = null } = req.body || {};
    if (!planId) return res.status(400).json({ success: false, error: 'planId required' });

    const response = await subscriptionService.subscribe(req.user.id, planId, {
      payment_method: paymentMethod,
      payment_details: paymentDetails
    });

    if (!response.success && response.requires_payment) {
      return res.status(402).json({ success: false, ...response });
    }

    res.status(201).json({ success: true, ...response });
  },

  async cancel(req, res) {
    const current = await Subscription.findOne({
      where: { user_id: req.user.id, status: 'active' },
      order: [['created_at', 'DESC']]
    });
    if (!current) {
      return res.status(404).json({ success: false, error: 'Active subscription not found' });
    }
    const response = await subscriptionService.cancelSubscription(req.user.id, current.id);
    res.json({
      success: true,
      message: response?.message || 'Subscription update submitted'
    });
  },

  async upgrade(req, res) {
    const { newPlanId, paymentMethod = null, paymentDetails = null } = req.body || {};
    if (!newPlanId) return res.status(400).json({ success: false, error: 'newPlanId required' });
    const response = await subscriptionService.subscribe(req.user.id, newPlanId, {
      payment_method: paymentMethod,
      payment_details: paymentDetails
    });
    if (!response.success && response.requires_payment) {
      return res.status(402).json({ success: false, ...response });
    }
    res.status(201).json({ success: true, ...response });
  }
};
