const crypto = require('crypto');
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { subscriptionLimiter } = require('../middleware/rateLimiter');
const { User, Plan } = require('../models');
const paymentService = require('../services/paymentService');
const subscriptionService = require('../services/subscriptionService');
const {
  updateRegistrationSessionForUser,
  recordRegistrationSecurityEvent
} = require('../services/registrationSessionService');
const logger = require('../config/logger');
const config = require('../config/env');
const { buildPaystackCallbackUrl } = require('../utils/callbackUrl');
const {
  getBillingIntent,
  isBillingIntentExpired,
  setBillingIntentOnPreferences
} = require('../utils/billingIntent');

const MAX_DURATION_MONTHS = 12;

const normalizeString = (value) => String(value || '').trim();
const normalizePhoneDigits = (value) => String(value || '').replace(/\D/g, '');
const isValidCheckoutEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeString(value));
const buildPhoneCheckoutEmail = (phoneNumber) => `phone.${normalizePhoneDigits(phoneNumber)}@auth.sharether.app`;

const parseDurationMonths = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_DURATION_MONTHS) {
    return null;
  }
  return parsed;
};

const resolveCheckoutEmail = (user) => {
  const rawEmail = normalizeString(user?.email);
  if (isValidCheckoutEmail(rawEmail) && !rawEmail.endsWith('@auth.sharether.local')) {
    return rawEmail.toLowerCase();
  }

  const phoneDigits = normalizePhoneDigits(user?.phone_number);
  if (phoneDigits) {
    return buildPhoneCheckoutEmail(phoneDigits).toLowerCase();
  }

  return rawEmail.toLowerCase();
};

const resolveDurationMonths = (metadata = {}, fallback = 1) => (
  parseDurationMonths(metadata.durationMonths ?? metadata.duration_months) ||
  parseDurationMonths(fallback) ||
  1
);

const resolvePlanByIdentifier = async (identifier) => {
  const normalized = normalizeString(identifier);
  if (!normalized) return null;

  const byId = await Plan.findByPk(normalized);
  if (byId) return byId;
  return Plan.findOne({ where: { name: normalized } });
};

const getNormalizedBillingIntent = async (user) => {
  const billingIntent = getBillingIntent(user);
  if (!billingIntent) return null;

  if (!isBillingIntentExpired(billingIntent)) {
    return billingIntent;
  }

  const nextPreferences = setBillingIntentOnPreferences(user.preferences, null);
  await user.update({ preferences: nextPreferences });
  user.preferences = nextPreferences;
  return null;
};

const getProrationMetadata = (billingContext) => {
  const proration = billingContext?.proration;
  if (!proration) return {};

  return {
    proration_applied: Boolean(proration.applied),
    proration_ratio: proration.ratio,
    proration_period_start: proration.periodStart?.toISOString?.() || null,
    proration_period_end: proration.periodEnd?.toISOString?.() || null,
    proration_current_plan_price: proration.currentPlanPrice,
    proration_target_plan_price: proration.targetPlanPrice,
    proration_plan_difference: proration.planDifference
  };
};

router.post('/checkout', authenticate, subscriptionLimiter, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const requestedDuration = req.body?.duration_months ?? req.body?.durationMonths;
    const durationMonths = resolveDurationMonths(req.body || {}, 1);
    const callbackUrl = buildPaystackCallbackUrl(
      req.body?.return_path || req.body?.returnPath,
      req
    );
    if (requestedDuration != null && parseDurationMonths(requestedDuration) == null) {
      return res.status(400).json({
        success: false,
        error: `duration_months must be between 1 and ${MAX_DURATION_MONTHS}`
      });
    }

    const requestedPlanId = req.body?.plan_id;
    const billingIntent = await getNormalizedBillingIntent(user);
    const hasOnboardingPendingPayment = Boolean(
      user.plan_status === 'pending_payment' && user.selected_plan_id
    );

    let planIdForCheckout = null;
    let explicitIntent = null;

    if (hasOnboardingPendingPayment) {
      planIdForCheckout = user.selected_plan_id;
      if (requestedPlanId && String(requestedPlanId) !== String(planIdForCheckout)) {
        return res.status(400).json({
          success: false,
          error: 'Checkout plan does not match selected onboarding plan'
        });
      }
    } else if (billingIntent?.plan_id) {
      planIdForCheckout = billingIntent.plan_id;
      explicitIntent = billingIntent.type || null;
      if (requestedPlanId && String(requestedPlanId) !== String(planIdForCheckout)) {
        return res.status(400).json({
          success: false,
          error: 'Checkout plan does not match pending billing intent'
        });
      }
    } else if (requestedPlanId) {
      planIdForCheckout = requestedPlanId;
    }

    if (!planIdForCheckout) {
      return res.status(400).json({
        success: false,
        error: 'Select a plan before checkout'
      });
    }

    const plan = await Plan.findByPk(planIdForCheckout);
    if (!plan || !plan.is_active) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const price = Number(plan.price || 0);
    if (price <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Selected plan does not require payment'
      });
    }

    let billingContext;
    try {
      billingContext = await subscriptionService.resolveBillingContext({
        userId: user.id,
        targetPlan: plan,
        durationMonths,
        explicitIntent
      });
    } catch (error) {
      if (error?.code === 'DOWNGRADE_NOT_ALLOWED' || error?.code === 'BILLING_INTENT_MISMATCH') {
        return res.status(400).json({ success: false, error: error.message });
      }
      throw error;
    }

    if (billingContext.baseAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'No payment amount was calculated for this change'
      });
    }

    const amountBreakdown = paymentService.calculateCustomerCharge(billingContext.baseAmount, 'GHS');
    const registrationSession = await updateRegistrationSessionForUser(user, {
      selected_plan_id: plan.id,
      duration_months: billingContext.chargedDurationMonths,
      stage: 'PAYMENT',
      metadata: {
        billing_kind: billingContext.billingKind,
        ...getProrationMetadata(billingContext),
        checkout_provider: 'paystack',
        checkout_source: 'billing',
        checkout_amount: amountBreakdown.totalAmount,
        checkout_base_amount: amountBreakdown.baseAmount,
        checkout_fee_amount: amountBreakdown.feeAmount
      }
    });
    await recordRegistrationSecurityEvent(registrationSession, 'payment_started', req, {
      plan_id: plan.id,
      billing_kind: billingContext.billingKind,
      duration_months: billingContext.chargedDurationMonths,
      amount: amountBreakdown.totalAmount
    });
    const checkout = await paymentService.initializePayment({
      userId: user.id,
      planId: plan.id,
      plan,
      amount: amountBreakdown.totalAmount,
      amountBreakdown,
      durationMonths: billingContext.chargedDurationMonths,
      metadata: {
        billing_kind: billingContext.billingKind,
        chargedDurationMonths: billingContext.chargedDurationMonths,
        ...getProrationMetadata(billingContext),
        registration_session_id: registrationSession?.id || null,
        source: 'billing_checkout'
      },
      callbackUrl,
      currency: 'GHS',
      email: resolveCheckoutEmail(user),
      paymentMethod: 'paystack'
    });

    return res.json({
      success: true,
      authorization_url: checkout.authorizationUrl,
      access_code: checkout.accessCode,
      reference: checkout.reference,
      provider: checkout.provider || 'paystack',
      billing_kind: billingContext.billingKind,
      duration_months: billingContext.chargedDurationMonths,
      amount: amountBreakdown.totalAmount,
      base_amount: amountBreakdown.baseAmount,
      fee_amount: amountBreakdown.feeAmount,
      proration: billingContext.proration,
      next_step: 'PAYMENT'
    });
  } catch (error) {
    logger.error('Billing checkout error:', error);
    return res.status(500).json({
      success: false,
      error: config.isProduction
        ? 'Failed to initialize checkout'
        : (error?.message || 'Failed to initialize checkout')
    });
  }
});

const MAX_EXTENSION_DAYS = 365;
const EXTENSION_PRESETS = [7, 14, 30, 60, 90];

router.post('/extend', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const days = Number.parseInt(req.body?.days, 10);
    if (!Number.isFinite(days) || days < 1 || days > MAX_EXTENSION_DAYS) {
      return res.status(400).json({ success: false, error: `days must be between 1 and ${MAX_EXTENSION_DAYS}` });
    }

    const activeSubscription = await subscriptionService.getActiveSubscriptionForBilling(user.id);
    if (!activeSubscription) {
      return res.status(400).json({ success: false, error: 'No active paid plan found' });
    }

    const plan = activeSubscription.plan || await Plan.findByPk(activeSubscription.plan_id);
    if (!plan) return res.status(400).json({ success: false, error: 'Plan not found' });

    const price = Number(plan.price || 0);
    if (price <= 0) {
      return res.status(400).json({ success: false, error: 'Extensions are only available for paid plans' });
    }

    const dailyRate = price / 30;
    const baseAmount = Math.round(dailyRate * days * 100) / 100;
    const amountBreakdown = paymentService.calculateCustomerCharge(baseAmount, 'GHS');

    const currentExpiresAt = activeSubscription.expires_at ? new Date(activeSubscription.expires_at) : new Date();
    const newExpiresAt = new Date(currentExpiresAt);
    newExpiresAt.setDate(newExpiresAt.getDate() + days);

    const callbackUrl = buildPaystackCallbackUrl('/settings?action=extend', req);

    const checkout = await paymentService.initializePayment({
      userId: user.id,
      planId: plan.id,
      plan,
      amount: amountBreakdown.totalAmount,
      amountBreakdown,
      durationMonths: 1,
      metadata: {
        billing_kind: 'extension',
        extension_days: days,
        extends_from: currentExpiresAt.toISOString(),
        new_expires_at: newExpiresAt.toISOString(),
        subscription_id: activeSubscription.id,
        source: 'settings_extend'
      },
      callbackUrl,
      currency: 'GHS',
      email: resolveCheckoutEmail(user),
      paymentMethod: 'paystack'
    });

    return res.json({
      success: true,
      authorization_url: checkout.authorizationUrl,
      reference: checkout.reference,
      provider: checkout.provider || 'paystack',
      days,
      base_amount: amountBreakdown.baseAmount,
      amount: amountBreakdown.totalAmount,
      fee_amount: amountBreakdown.feeAmount,
      extends_from: currentExpiresAt.toISOString(),
      new_expires_at: newExpiresAt.toISOString()
    });
  } catch (error) {
    logger.error('Billing extend error:', error);
    return res.status(500).json({
      success: false,
      error: config.isProduction ? 'Failed to initialize extension' : (error?.message || 'Failed to initialize extension')
    });
  }
});

router.post('/extend/verify', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const reference = String(req.body?.reference || '').trim();
    const provider = String(req.body?.provider || 'paystack').trim();
    if (!reference) return res.status(400).json({ success: false, error: 'reference is required' });

    const paymentResult = await paymentService.verifyPayment(reference, provider);
    if (!paymentResult.success) {
      return res.status(400).json({ success: false, error: 'Payment verification failed', status: paymentResult.status });
    }

    const metadata = paymentResult.metadata || {};
    if (String(metadata.billing_kind || '').toLowerCase() !== 'extension') {
      return res.status(400).json({ success: false, error: 'Reference is not for a plan extension' });
    }

    const days = Number.parseInt(metadata.extension_days, 10);
    if (!Number.isFinite(days) || days < 1) {
      return res.status(400).json({ success: false, error: 'Invalid extension days in payment metadata' });
    }

    const activeSubscription = await subscriptionService.getActiveSubscriptionForBilling(user.id);
    if (!activeSubscription) {
      return res.status(400).json({ success: false, error: 'No active subscription found' });
    }

    const currentExpiresAt = activeSubscription.expires_at ? new Date(activeSubscription.expires_at) : new Date();
    const newExpiresAt = new Date(currentExpiresAt);
    newExpiresAt.setDate(newExpiresAt.getDate() + days);

    await activeSubscription.update({
      expires_at: newExpiresAt,
      next_billing_date: new Date(newExpiresAt)
    });

    await subscriptionService.recordPaymentTransaction({
      userId: user.id,
      planId: activeSubscription.plan_id,
      provider,
      status: 'success',
      amount: paymentResult.amount || 0,
      currency: paymentResult.currency || 'GHS',
      reference: paymentResult.reference || reference,
      transactionId: paymentResult.transactionId || reference,
      paidAt: paymentResult.paidAt || new Date(),
      billingKind: 'extension',
      durationMonths: 1,
      customerContact: paymentResult.customerEmail || null,
      metadata: {
        ...metadata,
        extension_days: days,
        extended_from: currentExpiresAt.toISOString(),
        new_expires_at: newExpiresAt.toISOString(),
        source: 'extend_verify'
      }
    });

    return res.json({
      success: true,
      days,
      previous_expires_at: currentExpiresAt.toISOString(),
      new_expires_at: newExpiresAt.toISOString()
    });
  } catch (error) {
    logger.error('Billing extend verify error:', error);
    return res.status(500).json({
      success: false,
      error: config.isProduction ? 'Failed to verify extension' : (error?.message || 'Failed to verify extension')
    });
  }
});

router.post('/cancel-pending', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let patch = {};
    const activeSubscription = await subscriptionService.getActiveSubscriptionForBilling(user.id);
    if (
      user.plan_status === 'pending_payment' &&
      activeSubscription?.plan_id &&
      (!user.selected_plan_id || String(user.selected_plan_id) !== String(activeSubscription.plan_id))
    ) {
      patch = {
        selected_plan_id: activeSubscription.plan_id,
        plan_status: 'active',
        onboarding_step: 'DONE'
      };
    }

    const nextPreferences = setBillingIntentOnPreferences(user.preferences, null);
    patch.preferences = nextPreferences;
    await user.update(patch);

    return res.json({
      success: true,
      message: 'Pending checkout canceled'
    });
  } catch (error) {
    logger.error('Billing cancel pending error:', error);
    return res.status(500).json({ success: false, error: 'Failed to cancel pending checkout' });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!secret || !signature || !req.rawBody) {
      return res.status(400).json({ success: false, error: 'Invalid webhook setup' });
    }

    const hash = crypto.createHmac('sha512', secret).update(req.rawBody).digest('hex');
    if (hash !== signature) {
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const event = req.body || {};
    if (event.event === 'charge.success') {
      const payload = event.data || {};
      const metadata = payload.metadata || {};
      const durationMonths = resolveDurationMonths(metadata, 1);
      let userId = metadata.userId || metadata.user_id || null;
      let planId = metadata.planId || metadata.plan_id || metadata.appPlanId || null;
      let plan = null;
      const customerEmail = payload.customer?.email || null;
      const paystackPlanCode =
        payload.plan_object?.plan_code ||
        metadata.paystackPlanCode ||
        metadata.paystack_plan_code ||
        null;

      if (!userId && customerEmail) {
        const matchedUser = await User.findOne({ where: { email: customerEmail } });
        userId = matchedUser?.id || null;
      }

      if (planId) {
        plan = await Plan.findByPk(planId);
      }

      if (!plan && paystackPlanCode) {
        plan = await Plan.findOne({ where: { paystack_plan_code: paystackPlanCode } });
      }

      if (!plan && paystackPlanCode) {
        const mappedIdentifier = paymentService.resolvePlanIdentifierFromPaystackCode(paystackPlanCode);
        if (mappedIdentifier) {
          plan = await resolvePlanByIdentifier(mappedIdentifier);
        }
      }

      if (plan && !planId) {
        planId = plan.id;
      }

      const billingKind = String(metadata.billing_kind || metadata.billingKind || '').toLowerCase();

      if (billingKind === 'extension' && userId) {
        const extensionDays = Number.parseInt(metadata.extension_days, 10);
        if (Number.isFinite(extensionDays) && extensionDays > 0) {
          const activeSub = await subscriptionService.getActiveSubscriptionForBilling(userId);
          if (activeSub) {
            const currentExpiresAt = activeSub.expires_at ? new Date(activeSub.expires_at) : new Date();
            const newExpiresAt = new Date(currentExpiresAt);
            newExpiresAt.setDate(newExpiresAt.getDate() + extensionDays);
            await activeSub.update({ expires_at: newExpiresAt, next_billing_date: new Date(newExpiresAt) });
            const paidAmount = payload.amount ? Number(payload.amount) / 100 : null;
            await subscriptionService.recordPaymentTransaction({
              userId,
              planId: activeSub.plan_id,
              provider: 'paystack',
              status: 'success',
              amount: paidAmount || 0,
              currency: payload.currency || 'GHS',
              reference: payload.reference,
              transactionId: payload.id,
              paidAt: payload.paid_at,
              billingKind: 'extension',
              durationMonths: 1,
              customerContact: customerEmail,
              metadata: { ...metadata, source: 'webhook_extension' }
            });
            logger.info(`Extended subscription for user ${userId} by ${extensionDays} days via webhook`);
          }
        }
      } else if (!userId || !planId || !plan) {
        logger.warn('Skipped billing webhook activation: missing user/plan mapping');
      } else {
        const paidAmount = payload.amount ? Number(payload.amount) / 100 : null;
        const metadataTotalAmount = Number(metadata.totalAmount ?? metadata.total_amount);
        const expectedAmount = Number.isFinite(metadataTotalAmount)
          ? Number(metadataTotalAmount.toFixed(2))
          : Number((Number(plan.price || 0) * durationMonths).toFixed(2));
        if (paidAmount != null && paidAmount + 0.01 < expectedAmount) {
          logger.warn(`Skipped billing webhook activation: paid amount below expected amount (${paidAmount} < ${expectedAmount})`);
        } else {
          await subscriptionService.activatePaidPlanFromPayment(userId, planId, {
            provider: 'paystack',
            reference: payload.reference,
            transaction_id: payload.id,
            paid_at: payload.paid_at,
            amount: paidAmount,
            currency: payload.currency,
            customer_email: customerEmail,
            customer_code: payload.customer?.customer_code || null,
            authorization_code: payload.authorization?.authorization_code || null,
            paystack_plan_code: paystackPlanCode,
            duration_months: durationMonths,
            billing_kind: metadata.billing_kind || metadata.billingKind || null,
            charged_duration_months: metadata.charged_duration_months || metadata.chargedDurationMonths || durationMonths,
            metadata: {
              ...metadata,
              source: 'webhook'
            }
          });
          const paidUser = await User.findByPk(userId);
          const registrationSession = await updateRegistrationSessionForUser(paidUser, {
            selected_plan_id: planId,
            duration_months: durationMonths,
            stage: 'DONE',
            metadata: {
              payment_reference: payload.reference,
              payment_provider: 'paystack',
              payment_customer_contact: customerEmail,
              payment_verified_via: 'billing_webhook'
            }
          });
          await recordRegistrationSecurityEvent(registrationSession, 'payment_verified', req, {
            reference: payload.reference,
            provider: 'paystack',
            plan_id: planId,
            duration_months: durationMonths,
            source: 'billing_webhook'
          });
          await recordRegistrationSecurityEvent(registrationSession, 'registration_completed', req, {
            plan_id: planId,
            completion_source: 'billing_webhook'
          });
        }
      }
    } else if (event.event === 'charge.failed') {
      const payload = event.data || {};
      const metadata = payload.metadata || {};
      const userId = metadata.userId || metadata.user_id || null;
      if (userId) {
        await subscriptionService.clearUserBillingIntent(userId);
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    logger.error('Billing webhook error:', error);
    return res.sendStatus(500);
  }
});

module.exports = router;
