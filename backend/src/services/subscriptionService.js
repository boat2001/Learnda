const { Op } = require('sequelize');
const {
  Subscription,
  Plan,
  PlanFeature,
  User,
  PLSItem,
  Contribution,
  PaymentTransaction
} = require('../models');
const paymentService = require('./paymentService');
const emailService = require('./emailService');
const notificationService = require('./notificationService');
const logger = require('../config/logger');
const {
  setBillingIntentOnPreferences
} = require('../utils/billingIntent');

const MAX_PREPAY_MONTHS = 12;

class SubscriptionService {
  normalizeDurationMonths(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(Math.max(parsed, 1), MAX_PREPAY_MONTHS);
  }

  roundCurrency(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  clampRatio(value) {
    return Math.min(Math.max(Number(value) || 0, 0), 1);
  }

  shiftMonths(dateValue, monthDelta) {
    const date = this.parseDate(dateValue);
    if (!date) return null;
    date.setMonth(date.getMonth() + Number(monthDelta || 0));
    return date;
  }

  getSubscriptionDurationMonths(subscription) {
    const metadata = subscription?.payment_metadata || {};
    return this.normalizeDurationMonths(
      metadata.charged_duration_months ||
      metadata.chargedDurationMonths ||
      metadata.duration_months ||
      metadata.durationMonths ||
      1
    );
  }

  resolveProrationPeriod(subscription, at = new Date()) {
    const now = this.parseDate(at) || new Date();
    const periodEnd = this.parseDate(subscription?.next_billing_date || subscription?.expires_at);
    const durationMonths = this.getSubscriptionDurationMonths(subscription);
    const periodStart = periodEnd
      ? this.shiftMonths(periodEnd, -durationMonths)
      : this.parseDate(subscription?.started_at);
    const periodLengthMs = periodEnd && periodStart ? periodEnd - periodStart : 0;
    const remainingMs = periodEnd ? periodEnd - now : 0;
    const remainingRatio = periodLengthMs > 0 && remainingMs > 0
      ? this.clampRatio(remainingMs / periodLengthMs)
      : 0;

    return {
      durationMonths,
      periodStart,
      periodEnd,
      periodLengthMs,
      remainingMs: Math.max(remainingMs, 0),
      remainingRatio
    };
  }

  async getActiveSubscriptionForBilling(userId) {
    return Subscription.findOne({
      where: {
        user_id: userId,
        status: 'active'
      },
      include: [{ model: Plan, as: 'plan' }],
      order: [['created_at', 'DESC']]
    });
  }

  async clearUserBillingIntent(userId) {
    const user = await User.findByPk(userId);
    if (!user) return;
    const nextPreferences = setBillingIntentOnPreferences(user.preferences, null);
    if (JSON.stringify(nextPreferences) === JSON.stringify(user.preferences || {})) {
      return;
    }
    await user.update({ preferences: nextPreferences });
  }

  async resolveBillingContext({
    userId,
    targetPlan,
    durationMonths = 1,
    explicitIntent = null
  }) {
    if (!targetPlan) {
      throw new Error('Target plan is required');
    }

    const normalizedDurationMonths = this.normalizeDurationMonths(durationMonths);
    const activeSubscription = await this.getActiveSubscriptionForBilling(userId);
    const currentPlan = activeSubscription?.plan || null;
    const targetPrice = Number(targetPlan.price || 0);
    const currentPrice = Number(currentPlan?.price || 0);
    const samePlan = Boolean(
      activeSubscription &&
      String(activeSubscription.plan_id) === String(targetPlan.id)
    );
    const paidUpgradeCandidate = Boolean(
      activeSubscription &&
      !samePlan &&
      currentPrice > 0 &&
      targetPrice > currentPrice
    );
    const freeToPaidTransition = Boolean(
      activeSubscription &&
      !samePlan &&
      currentPrice <= 0 &&
      targetPrice > currentPrice
    );

    let billingKind = 'new_subscription';
    let chargedDurationMonths = normalizedDurationMonths;
    let baseAmount = this.roundCurrency(targetPrice * chargedDurationMonths);
    let proration = null;

    if (activeSubscription) {
      if (samePlan) {
        billingKind = 'renewal';
        baseAmount = this.roundCurrency(targetPrice * normalizedDurationMonths);
      } else if (paidUpgradeCandidate) {
        billingKind = 'upgrade';
        proration = this.resolveProrationPeriod(activeSubscription);

        if (proration.remainingRatio > 0) {
          chargedDurationMonths = proration.durationMonths;
          baseAmount = this.roundCurrency(
            (targetPrice - currentPrice) *
            proration.durationMonths *
            proration.remainingRatio
          );
        } else {
          chargedDurationMonths = normalizedDurationMonths;
          baseAmount = this.roundCurrency(targetPrice * normalizedDurationMonths);
        }
      } else if (freeToPaidTransition) {
        billingKind = 'new_subscription';
        baseAmount = this.roundCurrency(targetPrice * normalizedDurationMonths);
      } else if (targetPrice < currentPrice) {
        const error = new Error(
          'Downgrades are applied at cycle end. Keep current plan or choose a higher plan.'
        );
        error.code = 'DOWNGRADE_NOT_ALLOWED';
        throw error;
      } else {
        billingKind = 'plan_change';
        baseAmount = 0;
      }
    }

    if (
      explicitIntent === 'upgrade' &&
      billingKind !== 'upgrade' &&
      !(billingKind === 'new_subscription' && freeToPaidTransition)
    ) {
      const error = new Error('Billing intent mismatch for upgrade');
      error.code = 'BILLING_INTENT_MISMATCH';
      throw error;
    }

    if (explicitIntent === 'renewal' && billingKind !== 'renewal') {
      const error = new Error('Billing intent mismatch for renewal');
      error.code = 'BILLING_INTENT_MISMATCH';
      throw error;
    }

    return {
      billingKind,
      baseAmount,
      chargedDurationMonths,
      normalizedDurationMonths,
      activeSubscription,
      currentPlan,
      targetPlan,
      preserveCurrentExpiry: billingKind === 'upgrade' && Boolean(proration?.remainingRatio),
      proration: proration
        ? {
            applied: proration.remainingRatio > 0,
            ratio: proration.remainingRatio,
            periodStart: proration.periodStart,
            periodEnd: proration.periodEnd,
            currentPlanPrice: currentPrice,
            targetPlanPrice: targetPrice,
            planDifference: this.roundCurrency(targetPrice - currentPrice)
          }
        : null
    };
  }

  async recordPaymentTransaction({
    userId,
    planId,
    registrationSessionId = null,
    provider = 'paystack',
    status = 'success',
    amount = 0,
    currency = 'GHS',
    reference = null,
    transactionId = null,
    paidAt = null,
    billingKind = null,
    durationMonths = null,
    customerContact = null,
    metadata = {}
  }) {
    try {
      const normalizedReference = String(reference || '').trim();
      const normalizedTransactionId = String(transactionId || '').trim();
      const transactionReference = normalizedReference || normalizedTransactionId;
      if (!transactionReference) return null;

      const where = {
        provider: String(provider || 'paystack').trim().toLowerCase(),
        transaction_reference: transactionReference
      };

      const payload = {
        user_id: userId,
        registration_session_id: registrationSessionId || null,
        plan_id: planId || null,
        provider: where.provider,
        status: status || 'success',
        amount: Number(amount || 0),
        currency: String(currency || 'GHS').toUpperCase(),
        transaction_reference: transactionReference,
        provider_transaction_id: normalizedTransactionId || null,
        paid_at: paidAt ? new Date(paidAt) : new Date(),
        billing_kind: billingKind || null,
        duration_months: durationMonths != null ? Number(durationMonths) : null,
        customer_contact: customerContact || null,
        metadata: metadata || {}
      };

      const existing = await PaymentTransaction.findOne({ where });
      if (existing) {
        await existing.update(payload);
        return existing;
      }

      try {
        return await PaymentTransaction.create(payload);
      } catch (error) {
        if (error?.name === 'SequelizeUniqueConstraintError') {
          const concurrent = await PaymentTransaction.findOne({ where });
          if (concurrent) {
            await concurrent.update(payload);
            return concurrent;
          }
        }
        throw error;
      }
    } catch (error) {
      logger.error('Record payment transaction error:', error);
      return null;
    }
  }

  async getUserPlan(userId) {
    try {
      const subscription = await Subscription.findOne({
        where: { 
          user_id: userId,
          status: 'active'
        },
        include: [
          {
            model: Plan,
            as: 'plan',
            include: [
              {
                model: PlanFeature,
                as: 'features',
                attributes: ['feature_key', 'enabled', 'config']
              }
            ]
          }
        ]
      });

      // If no active subscription, return basic plan
      if (!subscription) {
        return await this.getDefaultPlan();
      }

      // Check if subscription is expired
      if (subscription.expires_at && new Date(subscription.expires_at) < new Date()) {
        await this.handleExpiredSubscription(subscription);
        return await this.getDefaultPlan();
      }

      return {
        ...subscription.plan.toJSON(),
        subscription_id: subscription.id,
        status: subscription.status,
        started_at: subscription.started_at,
        expires_at: subscription.expires_at,
        next_billing_date: subscription.next_billing_date || subscription.expires_at || null,
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        auto_renew: !subscription.cancel_at_period_end,
        duration_months: Number(
          subscription.payment_metadata?.duration_months ||
          subscription.payment_metadata?.durationMonths ||
          subscription.payment_metadata?.charged_duration_months ||
          subscription.payment_metadata?.chargedDurationMonths ||
          1
        ),
        hasFeature: (featureKey) => this.hasFeature(subscription.plan, featureKey),
        getFeatureConfig: (featureKey) => this.getFeatureConfig(subscription.plan, featureKey)
      };
    } catch (error) {
      logger.error('Get user plan error:', error);
      return await this.getDefaultPlan();
    }
  }

  async getDefaultPlan() {
    try {
      const basicPlan = await Plan.findOne({
        where: { name: 'Basic Student' },
        include: [
          {
            model: PlanFeature,
            as: 'features',
            attributes: ['feature_key', 'enabled', 'config']
          }
        ]
      });

      return {
        ...basicPlan.toJSON(),
        subscription_id: null,
        status: 'active',
        started_at: new Date(),
        expires_at: null,
        next_billing_date: null,
        cancel_at_period_end: false,
        auto_renew: false,
        duration_months: 1,
        hasFeature: (featureKey) => this.hasFeature(basicPlan, featureKey),
        getFeatureConfig: (featureKey) => this.getFeatureConfig(basicPlan, featureKey)
      };
    } catch (error) {
      logger.error('Get default plan error:', error);
      throw error;
    }
  }

  hasFeature(plan, featureKey) {
    if (!plan.features) return false;
    
    const feature = plan.features.find(f => f.feature_key === featureKey);
    return feature ? feature.enabled : false;
  }

  getFeatureConfig(plan, featureKey) {
    if (!plan.features) return null;
    
    const feature = plan.features.find(f => f.feature_key === featureKey);
    return feature ? feature.config : null;
  }

  async subscribe(userId, planId) {
    try {
      const plan = await Plan.findByPk(planId);
      if (!plan || !plan.is_active) {
        throw new Error('Plan not found or inactive');
      }

      const user = await User.findByPk(userId, {
        attributes: ['id', 'role']
      });

      // Check existing subscription
      const existingSubscription = await Subscription.findOne({
        where: {
          user_id: userId,
          status: 'active'
        }
      });

      if (user?.role === 'admin') {
        return await this.activatePlanDirect(userId, planId, {
          payment_method: 'admin_override',
          payment_reference: `admin-${Date.now()}`
        });
      }

      // Handle free plan
      if (Number(plan.price || 0) === 0) {
        return await this.handleFreePlan(userId, planId, existingSubscription);
      }

      // Paid plans require payment flow via /payment/initialize + /payment/verify
      return {
        success: false,
        requires_payment: true,
        error: 'Payment required. Initialize payment via /payment/initialize.'
      };
    } catch (error) {
      logger.error('Subscribe error:', error);
      throw error;
    }
  }

  async handleFreePlan(userId, planId, existingSubscription) {
    // Cancel existing paid subscription if any
    if (existingSubscription && existingSubscription.plan_id !== planId) {
      await existingSubscription.update({
        status: 'canceled',
        canceled_at: new Date(),
        cancel_at_period_end: false,
        cancel_requested_at: null
      });
    }

    // Create or update free subscription
    const subscription = await Subscription.findOrCreate({
      where: {
        user_id: userId,
        plan_id: planId
      },
      defaults: {
        user_id: userId,
        plan_id: planId,
        status: 'active',
        started_at: new Date(),
        cancel_at_period_end: false,
        cancel_requested_at: null
      }
    });

    const plan = await Plan.findByPk(planId);
    if (plan) {
      await User.update(
        {
          current_plan: plan.name,
          selected_plan_id: plan.id,
          plan_status: 'active',
          onboarding_step: 'DONE'
        },
        { where: { id: userId } }
      );
    }

      logger.info(`User ${userId} subscribed to free plan ${planId}`);

      return {
        success: true,
        subscription: subscription[0],
        is_free: true
      };
  }

  async activatePlanDirect(userId, planId, metadata = {}) {
    const plan = await Plan.findByPk(planId);
    if (!plan || !plan.is_active) {
      throw new Error('Plan not found or inactive');
    }

    const existingSubscription = await Subscription.findOne({
      where: {
        user_id: userId,
        status: 'active'
      }
    });

    if (existingSubscription && existingSubscription.plan_id !== plan.id) {
      await existingSubscription.update({
        status: 'canceled',
        canceled_at: new Date(),
        cancel_at_period_end: false,
        cancel_requested_at: null
      });
    }

    const planPrice = Number(plan.price || 0);
    let subscription = existingSubscription;

    if (!subscription || subscription.plan_id !== plan.id) {
      const payload = {
        user_id: userId,
        plan_id: plan.id,
        status: 'active',
        started_at: new Date(),
        cancel_at_period_end: false,
        cancel_requested_at: null,
        payment_method: metadata.payment_method || null,
        payment_reference: metadata.payment_reference || null,
        payment_metadata: metadata || null
      };

      if (planPrice > 0) {
        payload.expires_at = this.calculateExpiryDate(plan.id);
        payload.next_billing_date = this.calculateNextBillingDate(plan.id);
      }

      subscription = await Subscription.create(payload);
    }

    await User.update(
      {
        current_plan: plan.name,
        selected_plan_id: plan.id,
        plan_status: 'active',
        onboarding_step: 'DONE'
      },
      { where: { id: userId } }
    );

    logger.info(`User ${userId} activated plan ${planId} directly`);

    return {
      success: true,
      subscription,
      is_free: planPrice <= 0,
      bypassed_payment: true
    };
  }

  async handlePaidPlan(userId, planId, paymentData, existingSubscription) {
    const durationMonths = this.normalizeDurationMonths(
      paymentData?.duration_months || paymentData?.durationMonths || 1
    );

    // Process payment
    const paymentResult = await paymentService.processPayment({
      user_id: userId,
      plan_id: planId,
      amount: await this.calculateAmount(userId, planId),
      payment_method: paymentData.payment_method,
      payment_details: paymentData.payment_details,
      currency: 'GHS',
      is_prorated: !!existingSubscription
    });

    if (!paymentResult.success) {
      throw new Error(paymentResult.error);
    }

    // Cancel existing subscription if any
    if (existingSubscription) {
      await existingSubscription.update({
        status: 'canceled',
        canceled_at: new Date(),
        cancel_at_period_end: false,
        cancel_requested_at: null
      });
    }

    // Create new subscription
    const subscription = await Subscription.create({
      user_id: userId,
      plan_id: planId,
      status: 'active',
      started_at: new Date(),
      cancel_at_period_end: false,
      cancel_requested_at: null,
      expires_at: this.calculateExpiryDate(planId, durationMonths),
      payment_method: paymentData.payment_method,
      payment_reference: paymentResult.transaction_id,
      payment_metadata: {
        ...(paymentResult || {}),
        duration_months: durationMonths
      },
      next_billing_date: this.calculateNextBillingDate(planId, durationMonths)
    });

    const plan = await Plan.findByPk(planId);
    if (plan) {
      await User.update({ current_plan: plan.name }, { where: { id: userId } });
    }

    await this.recordPaymentTransaction({
      userId,
      planId,
      provider: paymentData.payment_method || 'paystack',
      status: 'success',
      amount: paymentResult.amount || plan?.price || 0,
      currency: paymentResult.currency || 'GHS',
      reference: paymentResult.reference || paymentResult.transaction_id,
      transactionId: paymentResult.transaction_id,
      paidAt: paymentResult.paid_at || new Date(),
      billingKind: paymentData?.billing_kind || paymentResult?.billing_kind || null,
      durationMonths,
      customerContact: paymentData?.customer_contact || paymentResult?.customer_email || null,
      metadata: paymentResult
    });

    // Send confirmation email
    const user = await User.findByPk(userId);
    await emailService.sendSubscriptionConfirmation(
      user.email,
      planId,
      paymentResult.transaction_id
    );

    logger.info(`User ${userId} subscribed to paid plan ${planId}, transaction: ${paymentResult.transaction_id}`);

    return {
      success: true,
      subscription,
      transaction_id: paymentResult.transaction_id,
      is_free: false
    };
  }

  async activatePaidPlanFromPayment(userId, planId, paymentMeta = {}) {
    const plan = await Plan.findByPk(planId);
    if (!plan || !plan.is_active) {
      throw new Error('Plan not found or inactive');
    }

    const existingSubscription = await this.getActiveSubscriptionForBilling(userId);

    const paymentReference = paymentMeta.transaction_id || paymentMeta.reference || null;
    const durationMonths = this.normalizeDurationMonths(
      paymentMeta.duration_months || paymentMeta.durationMonths || 1
    );
    const metadataInput = paymentMeta.metadata && typeof paymentMeta.metadata === 'object'
      ? paymentMeta.metadata
      : {};
    const billingKindRaw = String(
      paymentMeta.billing_kind ||
      paymentMeta.billingKind ||
      metadataInput.billing_kind ||
      metadataInput.billingKind ||
      ''
    ).trim().toLowerCase();
    const billingKind = billingKindRaw || null;
    const chargedDurationMonths = this.normalizeDurationMonths(
      paymentMeta.charged_duration_months ||
      paymentMeta.chargedDurationMonths ||
      metadataInput.charged_duration_months ||
      metadataInput.chargedDurationMonths ||
      durationMonths
    );
    const paymentSource = String(
      paymentMeta.source ||
      metadataInput.source ||
      metadataInput._source ||
      ''
    ).trim().toLowerCase();
    const paymentMetadata = {
      ...metadataInput,
      ...paymentMeta,
      duration_months: durationMonths,
      charged_duration_months: chargedDurationMonths,
      billing_kind: billingKind,
      activated_at: new Date().toISOString()
    };

    let subscription = existingSubscription;
    const isRenewal = Boolean(existingSubscription && existingSubscription.plan_id === plan.id);
    const isUpgrade = Boolean(
      existingSubscription &&
      existingSubscription.plan_id !== plan.id &&
      billingKind === 'upgrade'
    );

    if (existingSubscription && existingSubscription.plan_id === plan.id) {
      const renewalAnchor = this.resolveRenewalAnchor(
        existingSubscription.expires_at,
        paymentMeta.paid_at,
        chargedDurationMonths
      );
      await existingSubscription.update({
        status: 'active',
        canceled_at: null,
        cancel_at_period_end: false,
        cancel_requested_at: null,
        expires_at: renewalAnchor,
        payment_method: paymentMeta.payment_method || paymentMeta.provider || existingSubscription.payment_method,
        payment_reference: paymentReference || existingSubscription.payment_reference,
        payment_metadata: {
          ...(existingSubscription.payment_metadata || {}),
          ...paymentMetadata
        },
        next_billing_date: renewalAnchor
      });
      subscription = existingSubscription;
      logger.info(`Payment verified. User ${userId} renewed plan ${planId}`);
    } else if (isUpgrade) {
      const previousExpiryCandidate = existingSubscription.expires_at
        ? new Date(existingSubscription.expires_at)
        : null;
      const hasRemainingCycle = Boolean(
        previousExpiryCandidate &&
        !Number.isNaN(previousExpiryCandidate.getTime()) &&
        previousExpiryCandidate > new Date()
      );
      const upgradeAnchor = hasRemainingCycle
        ? previousExpiryCandidate
        : this.calculateExpiryDate(planId, chargedDurationMonths, paymentMeta.paid_at || null);

      await existingSubscription.update({
        status: 'active',
        plan_id: plan.id,
        canceled_at: null,
        cancel_at_period_end: false,
        cancel_requested_at: null,
        expires_at: upgradeAnchor,
        payment_method: paymentMeta.payment_method || paymentMeta.provider || existingSubscription.payment_method,
        payment_reference: paymentReference || existingSubscription.payment_reference,
        payment_metadata: {
          ...(existingSubscription.payment_metadata || {}),
          ...paymentMetadata,
          upgraded_from_plan_id: existingSubscription.plan_id
        },
        next_billing_date: upgradeAnchor
      });
      subscription = existingSubscription;
      logger.info(`Payment verified. User ${userId} upgraded to plan ${planId}`);
    } else {
      if (existingSubscription) {
        await existingSubscription.update({
          status: 'canceled',
          canceled_at: new Date(),
          cancel_at_period_end: false,
          cancel_requested_at: null
        });
      }

      subscription = await Subscription.create({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        started_at: new Date(),
        cancel_at_period_end: false,
        cancel_requested_at: null,
        expires_at: this.calculateExpiryDate(planId, chargedDurationMonths, paymentMeta.paid_at || null),
        payment_method: paymentMeta.payment_method || paymentMeta.provider || null,
        payment_reference: paymentReference,
        payment_metadata: paymentMetadata,
        next_billing_date: this.calculateNextBillingDate(planId, chargedDurationMonths, paymentMeta.paid_at || null)
      });

      logger.info(`Payment verified. User ${userId} subscribed to plan ${planId}`);
    }

    await User.update(
      {
        current_plan: plan.name,
        selected_plan_id: plan.id,
        plan_status: 'active',
        onboarding_step: 'DONE'
      },
      { where: { id: userId } }
    );
    await this.clearUserBillingIntent(userId);

    const user = await User.findByPk(userId);
    if (user?.email) {
      await emailService.sendSubscriptionConfirmation(
        user.email,
        plan.name,
        paymentMeta.transaction_id || paymentMeta.reference || 'verified'
      );
    }

    await this.recordPaymentTransaction({
      userId,
      planId,
      registrationSessionId: paymentMeta.registration_session_id || paymentMeta.registrationSessionId || metadataInput.registration_session_id || metadataInput.registrationSessionId || null,
      provider: paymentMeta.provider || 'paystack',
      status: 'success',
      amount: paymentMeta.amount != null ? paymentMeta.amount : plan.price,
      currency: paymentMeta.currency || 'GHS',
      reference: paymentMeta.reference || paymentMeta.transaction_id,
      transactionId: paymentMeta.transaction_id,
      paidAt: paymentMeta.paid_at,
      billingKind,
      durationMonths: chargedDurationMonths,
      customerContact: paymentMeta.customer_email || paymentMeta.customerContact || metadataInput.customer_contact || null,
      metadata: paymentMetadata
    });

    if (paymentSource === 'webhook' && isRenewal) {
      await this.notifyAutoRenewalSuccess(userId, plan, subscription);
    }

    return {
      success: true,
      subscription,
      transaction_id: paymentReference,
      is_free: false
    };
  }

  resolveRenewalAnchor(previousExpiryDate, paidAt, durationMonths = 1) {
    const now = new Date();
    const paidAtCandidate = paidAt ? new Date(paidAt) : now;
    const paidAtDate = Number.isNaN(paidAtCandidate.getTime()) ? now : paidAtCandidate;
    const previousExpiryCandidate = previousExpiryDate ? new Date(previousExpiryDate) : null;
    const previousExpiry = previousExpiryCandidate && !Number.isNaN(previousExpiryCandidate.getTime())
      ? previousExpiryCandidate
      : null;
    const anchor = previousExpiry && previousExpiry > paidAtDate ? previousExpiry : paidAtDate;
    anchor.setMonth(anchor.getMonth() + this.normalizeDurationMonths(durationMonths));
    return anchor;
  }

  async notifyAutoRenewalSuccess(userId, plan, subscription) {
    try {
      const renewalDate = this.getRenewalDate(subscription);
      await notificationService.createNotification({
        userId,
        title: 'Plan renewed automatically',
        body: `Your ${plan.name} plan has been renewed. Next renewal: ${renewalDate.toDateString()}.`,
        type: 'subscription_auto_renewed',
        action_url: '/settings?tab=billing',
        data: {
          plan_id: plan.id,
          plan_name: plan.name,
          renewal_date: renewalDate.toISOString()
        }
      });
    } catch (error) {
      logger.warn('Auto-renew notification failed:', error?.message || error);
    }
  }

  async notifyRenewalReminder(subscription, reminderDays = 3) {
    try {
      const [user, plan] = await Promise.all([
        User.findByPk(subscription.user_id),
        Plan.findByPk(subscription.plan_id)
      ]);
      if (!user || !plan || Number(plan.price || 0) <= 0) return false;

      await notificationService.createNotification({
        userId: user.id,
        title: 'Plan renewal reminder',
        body: `Your ${plan.name} plan renews in ${reminderDays} days. Keep enough balance for auto-renewal to avoid fallback to Basic Student.`,
        type: 'subscription_renewal_reminder',
        action_url: '/settings?tab=billing',
        data: {
          plan_id: plan.id,
          plan_name: plan.name,
          reminder_days: reminderDays,
          renewal_date: this.getRenewalDate(subscription).toISOString()
        }
      });

      if (user.email) {
        await emailService.sendEmail({
          to: user.email,
          subject: 'Sharether plan renewal reminder',
          text: `Your ${plan.name} plan renews in ${reminderDays} days. Ensure your mobile money account has enough balance for auto-renewal.`
        });
      }

      return true;
    } catch (error) {
      logger.warn('Renewal reminder notification failed:', error?.message || error);
      return false;
    }
  }

  async runLifecycleSweep() {
    const now = new Date();
    const isFirstDayOfMonth = now.getDate() === 1;

    const activeSubscriptions = await Subscription.findAll({
      where: { status: 'active' },
      include: [{ model: Plan, as: 'plan' }]
    });

    for (const subscription of activeSubscriptions) {
      try {
        const planPrice = Number(subscription?.plan?.price || 0);
        if (planPrice <= 0) continue;

        const renewalDate = this.getRenewalDate(subscription);
        const daysRemaining = this.daysUntil(renewalDate);
        const metadata = subscription.payment_metadata && typeof subscription.payment_metadata === 'object'
          ? { ...subscription.payment_metadata }
          : {};
        const reminderState = metadata.renewal_reminders && typeof metadata.renewal_reminders === 'object'
          ? { ...metadata.renewal_reminders }
          : {};

        if (daysRemaining === 3 && !reminderState.d3) {
          const sent = await this.notifyRenewalReminder(subscription, 3);
          if (sent) {
            reminderState.d3 = new Date().toISOString();
            metadata.renewal_reminders = reminderState;
            await subscription.update({ payment_metadata: metadata });
          }
        }

        if (isFirstDayOfMonth && renewalDate < now) {
          await this.handleExpiredSubscription(subscription);
        }
      } catch (error) {
        logger.warn(`Lifecycle sweep skipped subscription ${subscription.id}:`, error?.message || error);
      }
    }
  }

  async cancelSubscription(userId, subscriptionId) {
    try {
      const subscription = await Subscription.findOne({
        where: {
          id: subscriptionId,
          user_id: userId,
          status: 'active'
        },
        include: [{ model: Plan, as: 'plan' }]
      });

      if (!subscription) {
        throw new Error('Active subscription not found');
      }

      // Don't allow canceling free plan
      if (subscription.plan.price === 0) {
        throw new Error('Cannot cancel free plan');
      }

      if (!this.isMonthEndDecisionWindow(subscription)) {
        throw new Error(
          'Plan changes can only be confirmed at month end. In the final 3 days, choose continue, upgrade, or cancel.'
        );
      }

      await subscription.update({
        cancel_at_period_end: true,
        cancel_requested_at: new Date()
      });

      logger.info(`Subscription canceled: ${subscriptionId} for user ${userId}`);

      return {
        success: true,
        message: 'Cancellation has been scheduled for the end of the current billing cycle'
      };
    } catch (error) {
      logger.error('Cancel subscription error:', error);
      throw error;
    }
  }

  async assignFreePlan(userId) {
    const basicPlan = await Plan.findOne({ where: { name: 'Basic Student' } });
    if (basicPlan) {
      await Subscription.create({
        user_id: userId,
        plan_id: basicPlan.id,
        status: 'active',
        started_at: new Date(),
        cancel_at_period_end: false,
        cancel_requested_at: null
      });
      await User.update(
        {
          current_plan: basicPlan.name,
          selected_plan_id: basicPlan.id,
          plan_status: 'active',
          onboarding_step: 'DONE'
        },
        { where: { id: userId } }
      );
    }
  }

  async calculateAmount(userId, newPlanId) {
    const newPlan = await Plan.findByPk(newPlanId);
    const context = await this.resolveBillingContext({
      userId,
      targetPlan: newPlan,
      durationMonths: 1
    });
    return context.baseAmount;
  }

  calculateExpiryDate(planId, durationMonths = 1, anchorDate = null) {
    // This would typically fetch plan billing cycle from database
    // For now, assume monthly billing for paid plans
    const start = anchorDate ? new Date(anchorDate) : new Date();
    const expiry = Number.isNaN(start.getTime()) ? new Date() : start;
    expiry.setMonth(expiry.getMonth() + this.normalizeDurationMonths(durationMonths));
    return expiry;
  }

  calculateNextBillingDate(planId, durationMonths = 1, anchorDate = null) {
    return this.calculateExpiryDate(planId, durationMonths, anchorDate);
  }

  getRenewalDate(subscription) {
    if (subscription?.next_billing_date) return new Date(subscription.next_billing_date);
    if (subscription?.expires_at) return new Date(subscription.expires_at);

    const startedAt = subscription?.started_at ? new Date(subscription.started_at) : new Date();
    startedAt.setMonth(startedAt.getMonth() + 1);
    return startedAt;
  }

  daysUntil(dateValue) {
    if (!dateValue) return null;
    const now = new Date();
    const target = new Date(dateValue);
    const diff = target - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  isMonthEndDecisionWindow(subscription, windowDays = 3) {
    const renewalDate = this.getRenewalDate(subscription);
    const daysRemaining = this.daysUntil(renewalDate);
    return daysRemaining != null && daysRemaining >= 0 && daysRemaining <= windowDays;
  }

  async handleExpiredSubscription(subscription) {
    try {
      subscription.status = 'expired';
      await subscription.save();

      // Assign free plan
      await this.assignFreePlan(subscription.user_id);
      await this.clearUserBillingIntent(subscription.user_id);

      const expiredPlan = await Plan.findByPk(subscription.plan_id);
      if (expiredPlan) {
        await notificationService.createNotification({
          userId: subscription.user_id,
          title: 'Plan expired',
          body: `Your ${expiredPlan.name} plan expired and your account was moved to Basic Student.`,
          type: 'subscription_expired',
          action_url: '/settings?tab=billing',
          data: {
            plan_id: expiredPlan.id,
            plan_name: expiredPlan.name
          }
        });
      }

      // Notify user
      const user = await User.findByPk(subscription.user_id);
      if (user?.email) {
        await emailService.sendSubscriptionExpired(
          user.email,
          subscription.plan_id
        );
      }

      logger.info(`Subscription expired: ${subscription.id} for user ${subscription.user_id}`);
    } catch (error) {
      logger.error('Handle expired subscription error:', error);
    }
  }

  calculateDaysRemaining(expiryDate) {
    if (!expiryDate) return null;
    
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  async getAllPlans() {
    try {
      const plans = await Plan.findAll({
        where: { is_active: true },
        include: [
          {
            model: PlanFeature,
            as: 'features',
            attributes: ['feature_key', 'enabled', 'config']
          }
        ],
        order: [['price', 'ASC']]
      });

      return plans;
    } catch (error) {
      logger.error('Get all plans error:', error);
      throw error;
    }
  }
}

module.exports = new SubscriptionService();
