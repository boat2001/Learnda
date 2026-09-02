// routes/payment.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { authenticate, optionalAuth } = require('../middleware/auth');
const { subscriptionLimiter } = require('../middleware/rateLimiter');
const { User, Plan } = require('../models');
const paymentService = require('../services/paymentService');
const subscriptionService = require('../services/subscriptionService');
const emailService = require('../services/emailService');
const {
  updateRegistrationSessionForUser,
  recordRegistrationSecurityEvent
} = require('../services/registrationSessionService');
const logger = require('../config/logger');
const config = require('../config/env');
const {
  getBillingIntent,
  isBillingIntentExpired,
  setBillingIntentOnPreferences
} = require('../utils/billingIntent');
const { buildPaystackCallbackUrl } = require('../utils/callbackUrl');

const MAX_DURATION_MONTHS = 12;
const MIN_DONATION_AMOUNT = 5;
const MAX_DONATION_AMOUNT = 50000;
const DONATION_PAYMENT_METHODS = new Set(['paystack', 'momo']);
const SUBSCRIPTION_PAYMENT_METHODS = new Set(['paystack', 'momo']);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDurationMonths = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_DURATION_MONTHS) {
    return null;
  }
  return parsed;
};

const resolveDurationMonths = (metadata = {}, fallback = 1) => (
  parseDurationMonths(metadata.durationMonths ?? metadata.duration_months) ||
  parseDurationMonths(fallback) ||
  1
);

const normalizePaymentMethod = (value, fallback = 'paystack') => {
  const normalized = normalizeString(value).toLowerCase();
  return normalized || fallback;
};

const isPaymentSuccessStatus = (status) => {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'success' || normalized === 'succeeded';
};

const normalizeString = (value) => String(value || '').trim();
const normalizePhoneDigits = (value) => String(value || '').replace(/\D/g, '');
const PLACEHOLDER_EMAIL_PATTERN = /^phone\.(\d+)@auth\.learnda\.(?:local|app)$/i;
const isValidCheckoutEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeString(value));

const extractPlaceholderPhoneDigits = (email) => {
  const normalizedEmail = normalizeString(email).toLowerCase();
  const match = normalizedEmail.match(PLACEHOLDER_EMAIL_PATTERN);
  return match ? match[1] : '';
};

const buildPhoneCheckoutEmail = (phoneDigits) => (
  `phone.${normalizePhoneDigits(phoneDigits)}@auth.learnda.app`
);

const resolveCheckoutEmail = (userLike = {}) => {
  const rawEmail = normalizeString(userLike?.email || userLike).toLowerCase();
  if (isValidCheckoutEmail(rawEmail) && !rawEmail.endsWith('@auth.learnda.local')) {
    return rawEmail;
  }

  const phoneDigits = (
    normalizePhoneDigits(userLike?.phone_number || userLike?.phone) ||
    extractPlaceholderPhoneDigits(rawEmail)
  );
  if (phoneDigits) {
    return buildPhoneCheckoutEmail(phoneDigits).toLowerCase();
  }

  return rawEmail;
};

const isReceiptEmail = (email) => (
  isValidCheckoutEmail(email) && !extractPlaceholderPhoneDigits(email)
);

const normalizePaymentCustomerIdentity = (userLike) => {
  const email = normalizeString(userLike?.email || userLike).toLowerCase();
  if (!email) return { email: '', phoneDigits: '' };

  const placeholderPhoneDigits = extractPlaceholderPhoneDigits(email);
  if (placeholderPhoneDigits) {
    return {
      email,
      phoneDigits: placeholderPhoneDigits
    };
  }

  return {
    email,
    phoneDigits: normalizePhoneDigits(userLike?.phone_number)
  };
};

const doesPaymentCustomerMatchUser = (customerEmail, user) => {
  const customerIdentity = normalizePaymentCustomerIdentity(customerEmail);
  const userIdentity = normalizePaymentCustomerIdentity(user);

  if (!customerIdentity.email || !userIdentity.email) {
    return false;
  }

  if (customerIdentity.email === userIdentity.email) {
    return true;
  }

  if (
    customerIdentity.phoneDigits &&
    userIdentity.phoneDigits &&
    customerIdentity.phoneDigits === userIdentity.phoneDigits
  ) {
    return true;
  }

  return false;
};

const findUserByPaymentCustomerEmail = async (customerEmail) => {
  const normalizedEmail = normalizeString(customerEmail).toLowerCase();
  if (!normalizedEmail) return null;

  const exactMatch = await User.findOne({ where: { email: normalizedEmail } });
  if (exactMatch) return exactMatch;

  const placeholderPhoneDigits = extractPlaceholderPhoneDigits(normalizedEmail);
  if (!placeholderPhoneDigits) return null;

  const [localVariant, appVariant] = [
    `phone.${placeholderPhoneDigits}@auth.learnda.local`,
    `phone.${placeholderPhoneDigits}@auth.learnda.app`
  ];

  if (normalizedEmail !== localVariant) {
    const localMatch = await User.findOne({ where: { email: localVariant } });
    if (localMatch) return localMatch;
  }

  if (normalizedEmail !== appVariant) {
    const appMatch = await User.findOne({ where: { email: appVariant } });
    if (appMatch) return appMatch;
  }

  return null;
};

const resolvePlanByIdentifier = async (identifier) => {
  const value = normalizeString(identifier);
  if (!value) return null;

  const byId = await Plan.findByPk(value);
  if (byId) return byId;

  return Plan.findOne({ where: { name: value } });
};

const getNormalizedBillingIntent = async (user) => {
  const billingIntent = getBillingIntent(user);
  if (!billingIntent) return null;
  if (!isBillingIntentExpired(billingIntent)) return billingIntent;

  const nextPreferences = setBillingIntentOnPreferences(user.preferences, null);
  await user.update({ preferences: nextPreferences });
  user.preferences = nextPreferences;
  return null;
};

const buildSupportRecipients = () => (
  Array.isArray(config.resend?.supportRecipients) && config.resend.supportRecipients.length
    ? config.resend.supportRecipients
    : [config.resend?.from].filter(Boolean)
);

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

/**
 * Initialize contribution payment
 * POST /payment/donations/initialize
 */
router.post('/donations/initialize', optionalAuth, async (req, res) => {
  try {
    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod, 'paystack');
    const donorName = normalizeString(
      req.body?.name ||
      req.user?.full_name ||
      req.user?.name ||
      [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ')
    );
    const donorEmail = normalizeString(req.body?.email || req.user?.email).toLowerCase();
    const donorPhone = normalizeString(req.body?.phone || req.user?.phone_number);
    const donorMessage = normalizeString(req.body?.message);
    const supportType = normalizeString(req.body?.supportType || 'one_time').toLowerCase();
    const donationAmount = toNumber(req.body?.amount);

    if (!DONATION_PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported contribution payment method'
      });
    }

    if (!donorName || !donorEmail) {
      return res.status(400).json({
        success: false,
        error: 'name and email are required'
      });
    }

    const checkoutEmail = resolveCheckoutEmail({
      email: donorEmail,
      phone: donorPhone
    });
    if (!isValidCheckoutEmail(checkoutEmail)) {
      return res.status(400).json({
        success: false,
        error: 'A valid email or phone number is required for checkout'
      });
    }

    if (!Number.isFinite(donationAmount) || donationAmount < MIN_DONATION_AMOUNT || donationAmount > MAX_DONATION_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Contribution amount must be between GH${MIN_DONATION_AMOUNT} and GH${MAX_DONATION_AMOUNT}`
      });
    }

    const amountBreakdown = paymentService.calculateCustomerCharge(donationAmount, 'GHS');
    const callbackUrl = buildPaystackCallbackUrl('/contribute', req);
    const paymentResult = await paymentService.initializePayment({
      userId: req.user?.id || null,
      planId: null,
      amount: amountBreakdown.totalAmount,
      amountBreakdown,
      durationMonths: 1,
      currency: 'GHS',
      email: checkoutEmail,
      paymentMethod,
      callbackUrl,
      metadata: {
        type: 'contribution',
        support_type: supportType,
        donor_name: donorName,
        donor_email: donorEmail,
        donor_phone: donorPhone || null,
        donor_message: donorMessage || null,
        source: 'contribute_page'
      }
    });

    return res.json({
      success: true,
      data: {
        ...paymentResult,
        provider: paymentResult.provider || paymentMethod,
        contribution_amount: amountBreakdown.baseAmount,
        amount: amountBreakdown.totalAmount,
        base_amount: amountBreakdown.baseAmount,
        fee_amount: amountBreakdown.feeAmount,
        currency: amountBreakdown.currency,
        support_type: supportType
      }
    });
  } catch (error) {
    logger.error('Contribution initialization error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Verify contribution payment
 * POST /payment/donations/verify
 */
router.post('/donations/verify', optionalAuth, async (req, res) => {
  try {
    const reference = normalizeString(req.body?.reference);
    const provider = normalizePaymentMethod(req.body?.provider, 'paystack');

    if (!reference) {
      return res.status(400).json({ success: false, error: 'reference is required' });
    }

    if (!DONATION_PAYMENT_METHODS.has(provider)) {
      return res.status(400).json({ success: false, error: 'Unsupported contribution provider' });
    }

    const paymentResult = await paymentService.verifyPayment(reference, provider);
    if (!paymentResult.success || !isPaymentSuccessStatus(paymentResult.status)) {
      return res.status(400).json({
        success: false,
        error: 'Contribution verification failed',
        status: paymentResult.status
      });
    }

    const metadata = paymentResult.metadata || {};
    if (!['contribution', 'donation'].includes(normalizeString(metadata.type).toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Payment reference does not belong to a contribution'
      });
    }

    if (req.user?.id && metadata.userId && String(metadata.userId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Contribution does not belong to this user'
      });
    }

    const paidAmount = toNumber(paymentResult.amount);
    const expectedAmount = toNumber(metadata.totalAmount ?? metadata.total_amount);
    if (paidAmount != null && expectedAmount != null && paidAmount + 0.01 < expectedAmount) {
      return res.status(400).json({
        success: false,
        error: `Paid amount (${paidAmount}) is less than expected amount (${expectedAmount})`
      });
    }

    const donorName = normalizeString(metadata.donor_name || req.user?.full_name || req.user?.name);
    const donorEmail = normalizeString(metadata.donor_email || paymentResult.customerEmail || req.user?.email).toLowerCase();
    const donorPhone = normalizeString(metadata.donor_phone || req.user?.phone_number);
    const donorMessage = normalizeString(metadata.donor_message);
    const supportType = normalizeString(metadata.support_type || 'one_time');

    if (req.user?.id) {
      await subscriptionService.recordPaymentTransaction({
        userId: req.user.id,
        planId: null,
        provider,
        status: 'success',
        amount: paidAmount != null ? paidAmount : expectedAmount || 0,
        currency: paymentResult.currency || 'GHS',
        reference: paymentResult.reference || reference,
        transactionId: paymentResult.transactionId || reference,
        paidAt: paymentResult.paidAt || new Date(),
        billingKind: 'contribution',
        durationMonths: 1,
        customerContact: donorEmail || donorPhone || null,
        metadata: {
          ...metadata,
          source: 'contribution_verify',
          verified_at: new Date().toISOString()
        }
      });
    }

    const supportRecipients = buildSupportRecipients();
    if (supportRecipients.length) {
      await emailService.sendSupportReport({
        to: supportRecipients,
        subject: `Learnda contribution received (${paymentResult.currency || 'GHS'} ${paidAmount ?? expectedAmount ?? 0})`,
        reporter: donorEmail ? `${donorName || 'Contributor'} (${donorEmail})` : (donorName || 'Contributor'),
        category: 'Contribution',
        message: [
          `Amount: ${paymentResult.currency || 'GHS'} ${paidAmount ?? expectedAmount ?? 0}`,
          `Provider: ${provider}`,
          `Reference: ${paymentResult.reference || reference}`,
          `Support type: ${supportType || 'one_time'}`,
          donorPhone ? `Phone: ${donorPhone}` : null,
          donorMessage ? `Message: ${donorMessage}` : null
        ].filter(Boolean).join('\n')
      });
    }

    if (isReceiptEmail(donorEmail)) {
      await emailService.sendEmail({
        to: donorEmail,
        subject: 'Your Learnda contribution was received',
        text: [
          `Hi ${donorName || 'there'},`,
          '',
          `We received your contribution of ${paymentResult.currency || 'GHS'} ${paidAmount ?? expectedAmount ?? 0}.`,
          `Reference: ${paymentResult.reference || reference}`,
          supportType ? `Support type: ${supportType}` : null,
          '',
          'Thank you for supporting Learnda.'
        ].filter(Boolean).join('\n')
      });
    }

    return res.json({
      success: true,
      data: {
        reference: paymentResult.reference || reference,
        provider,
        amount: paidAmount ?? expectedAmount ?? 0,
        currency: paymentResult.currency || 'GHS',
        donor_name: donorName || null,
        donor_email: donorEmail || null,
        support_type: supportType || 'one_time',
        message: 'Contribution verified successfully'
      }
    });
  } catch (error) {
    logger.error('Contribution verification error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Initialize payment for subscription upgrade
 * POST /payment/initialize
 */
router.post('/initialize', authenticate, subscriptionLimiter, async (req, res) => {
  try {
    const { planId } = req.body;
    const paymentMethod = normalizePaymentMethod(req.body?.paymentMethod, 'paystack');
    if (!SUBSCRIPTION_PAYMENT_METHODS.has(paymentMethod)) {
      return res.status(400).json({ success: false, error: 'Only Paystack and mobile money are supported' });
    }
    const requestedDuration = req.body?.duration_months ?? req.body?.durationMonths;
    if (requestedDuration != null && parseDurationMonths(requestedDuration) == null) {
      return res.status(400).json({
        success: false,
        error: `duration_months must be between 1 and ${MAX_DURATION_MONTHS}`
      });
    }
    const durationMonths = resolveDurationMonths(req.body || {}, 1);
    const freshUser = await User.findByPk(req.user.id);
    if (!freshUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const plan = await Plan.findByPk(planId);

    if (!plan || !plan.is_active) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    if (Number(plan.price || 0) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Selected plan does not require payment'
      });
    }

    let explicitIntent = null;
    if (freshUser.role !== 'admin') {
      const hasOnboardingPendingPayment = Boolean(
        freshUser.plan_status === 'pending_payment' &&
        freshUser.selected_plan_id
      );
      const billingIntent = await getNormalizedBillingIntent(freshUser);

      if (hasOnboardingPendingPayment) {
        if (String(freshUser.selected_plan_id) !== String(plan.id)) {
          return res.status(400).json({
            success: false,
            error: 'Select this plan before starting payment'
          });
        }
      } else if (billingIntent?.plan_id) {
        if (String(billingIntent.plan_id) !== String(plan.id)) {
          return res.status(400).json({
            success: false,
            error: 'Select this plan before starting payment'
          });
        }
        explicitIntent = billingIntent.type || null;
      } else {
        return res.status(400).json({
          success: false,
          error: 'No pending plan selection found for payment'
        });
      }
    }

    let billingContext;
    try {
      billingContext = await subscriptionService.resolveBillingContext({
        userId: freshUser.id,
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
    const registrationSession = await updateRegistrationSessionForUser(freshUser, {
      selected_plan_id: plan.id,
      duration_months: billingContext.chargedDurationMonths,
      stage: 'PAYMENT',
      metadata: {
        billing_kind: billingContext.billingKind,
        ...getProrationMetadata(billingContext),
        checkout_provider: paymentMethod,
        checkout_source: 'payment_initialize',
        checkout_amount: amountBreakdown.totalAmount,
        checkout_base_amount: amountBreakdown.baseAmount,
        checkout_fee_amount: amountBreakdown.feeAmount
      }
    });
    await recordRegistrationSecurityEvent(registrationSession, 'payment_started', req, {
      plan_id: plan.id,
      billing_kind: billingContext.billingKind,
      duration_months: billingContext.chargedDurationMonths,
      provider: paymentMethod,
      amount: amountBreakdown.totalAmount
    });
    const paymentResult = await paymentService.initializePayment({
      userId: freshUser.id,
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
        source: 'payment_initialize'
      },
      currency: 'GHS', // Ghana Cedis default
      email: resolveCheckoutEmail(freshUser),
      paymentMethod,
      phone: freshUser.phone_number
    });

    res.json({
      success: true,
      data: {
        ...paymentResult,
        billing_kind: billingContext.billingKind,
        duration_months: billingContext.chargedDurationMonths,
        amount: amountBreakdown.totalAmount,
        base_amount: amountBreakdown.baseAmount,
        fee_amount: amountBreakdown.feeAmount,
        proration: billingContext.proration
      }
    });
  } catch (error) {
    logger.error('Payment initialization error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Verify payment and activate subscription
 * POST /payment/verify
 */
router.post('/verify', authenticate, subscriptionLimiter, async (req, res) => {
  try {
    const { reference, planId } = req.body || {};
    const provider = normalizePaymentMethod(req.body?.provider, 'paystack');
    if (!SUBSCRIPTION_PAYMENT_METHODS.has(provider)) {
      return res.status(400).json({ success: false, error: 'Unsupported payment provider' });
    }
    const requestedDurationRaw = req.body?.duration_months ?? req.body?.durationMonths;
    if (requestedDurationRaw != null && parseDurationMonths(requestedDurationRaw) == null) {
      return res.status(400).json({
        success: false,
        error: `duration_months must be between 1 and ${MAX_DURATION_MONTHS}`
      });
    }
    const requestedDurationMonths = parseDurationMonths(req.body?.duration_months ?? req.body?.durationMonths);
    if (!reference) {
      return res.status(400).json({ success: false, error: 'reference is required' });
    }

    const freshUser = await User.findByPk(req.user.id);
    if (!freshUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const isAdmin = freshUser.role === 'admin';
    const billingIntent = !isAdmin ? await getNormalizedBillingIntent(freshUser) : null;
    const hasOnboardingPendingPayment = Boolean(
      !isAdmin &&
      freshUser.plan_status === 'pending_payment' &&
      freshUser.selected_plan_id
    );
    const expectedPlanFromState = hasOnboardingPendingPayment
      ? freshUser.selected_plan_id
      : (billingIntent?.plan_id || null);

    if (!isAdmin && !hasOnboardingPendingPayment && !billingIntent) {
      if (
        freshUser.plan_status === 'active' &&
        freshUser.selected_plan_id &&
        (!planId || String(planId) === String(freshUser.selected_plan_id))
      ) {
        return res.json({
          success: true,
          data: {
            already_active: true,
            message: 'Plan is already active'
          }
        });
      }

      return res.status(400).json({
        success: false,
        error: 'No pending payment found for this account'
      });
    }

    if (!isAdmin && expectedPlanFromState && planId && String(planId) !== String(expectedPlanFromState)) {
      return res.status(400).json({
        success: false,
        error: 'Verification plan does not match selected plan'
      });
    }

    // Verify payment
    const paymentResult = await paymentService.verifyPayment(reference, provider);
    if (!paymentResult.success || !isPaymentSuccessStatus(paymentResult.status)) {
      if (billingIntent) {
        await subscriptionService.clearUserBillingIntent(freshUser.id);
      }
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed',
        status: paymentResult.status
      });
    }

    const metadata = paymentResult.metadata || {};
    const metadataPlanId = metadata.planId;
    const metadataDurationMonths = parseDurationMonths(metadata.durationMonths ?? metadata.duration_months);
    const metadataUserId = metadata.userId || metadata.user_id;
    const durationMonths = metadataDurationMonths || requestedDurationMonths || 1;

    if (provider === 'paystack' && !metadataUserId) {
      return res.status(400).json({
        success: false,
        error: 'Payment metadata is missing user information'
      });
    }

    if (metadataUserId && String(metadataUserId) !== String(freshUser.id)) {
      return res.status(403).json({
        success: false,
        error: 'Payment does not belong to this user'
      });
    }

    if (metadataPlanId && planId && String(metadataPlanId) !== String(planId)) {
      return res.status(400).json({
        success: false,
        error: 'Payment plan mismatch'
      });
    }

    const expectedPlanId = expectedPlanFromState || planId || freshUser.selected_plan_id || null;
    const finalPlanId = metadataPlanId || expectedPlanId;
    if (!finalPlanId) {
      return res.status(400).json({ success: false, error: 'Plan ID is required' });
    }

    if (!isAdmin && expectedPlanFromState && String(finalPlanId) !== String(expectedPlanFromState)) {
      return res.status(400).json({
        success: false,
        error: 'Payment does not match your currently selected plan'
      });
    }

    if (metadataDurationMonths && requestedDurationMonths && metadataDurationMonths !== requestedDurationMonths) {
      return res.status(400).json({
        success: false,
        error: 'Payment duration mismatch'
      });
    }

    const plan = await Plan.findByPk(finalPlanId);
    if (!plan || !plan.is_active) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    if (Number(plan.price || 0) <= 0) {
      return res.status(400).json({ success: false, error: 'Selected plan does not require payment' });
    }

    const paidAmount = toNumber(paymentResult.amount);
    const metadataTotalAmount = toNumber(metadata.totalAmount ?? metadata.total_amount);
    const planPrice = Number(plan.price || 0);
    const expectedAmount = metadataTotalAmount != null
      ? Number(metadataTotalAmount.toFixed(2))
      : Number((planPrice * durationMonths).toFixed(2));
    if (paidAmount != null && paidAmount + 0.01 < expectedAmount) {
      return res.status(400).json({
        success: false,
        error: `Paid amount (${paidAmount}) is less than expected amount (${expectedAmount})`
      });
    }

    if (
      provider === 'paystack' &&
      paymentResult.customerEmail &&
      !doesPaymentCustomerMatchUser(paymentResult.customerEmail, freshUser)
    ) {
      return res.status(403).json({
        success: false,
        error: 'Payment customer does not match authenticated user'
      });
    }

    if (provider === 'paystack') {
      const expectedPaystackPlanCode = paymentService.resolvePaystackPlanCode(plan);
      if (
        expectedPaystackPlanCode &&
        paymentResult.planCode &&
        normalizeString(expectedPaystackPlanCode) !== normalizeString(paymentResult.planCode)
      ) {
        return res.status(400).json({
          success: false,
          error: 'Payment plan code does not match selected plan'
        });
      }
    }

    const subscriptionResult = await subscriptionService.activatePaidPlanFromPayment(freshUser.id, plan.id, {
      provider,
      reference,
      transaction_id: paymentResult.transactionId || reference,
      amount: paymentResult.amount,
      currency: paymentResult.currency,
      paid_at: paymentResult.paidAt || null,
      customer_email: paymentResult.customerEmail || null,
      customer_code: paymentResult.customerCode || null,
      authorization_code: paymentResult.authorizationCode || null,
      paystack_plan_code: paymentResult.planCode || null,
      channel: paymentResult.channel || null,
      duration_months: durationMonths,
      billing_kind: metadata.billing_kind || metadata.billingKind || billingIntent?.type || null,
      charged_duration_months: metadata.charged_duration_months || metadata.chargedDurationMonths || durationMonths,
      metadata: {
        ...metadata,
        source: 'verify'
      }
    });
    const registrationSession = await updateRegistrationSessionForUser(freshUser, {
      selected_plan_id: plan.id,
      duration_months: durationMonths,
      stage: 'DONE',
      metadata: {
        payment_reference: reference,
        payment_provider: provider,
        payment_customer_contact: paymentResult.customerEmail || null,
        payment_verified_via: 'payment_verify'
      }
    });
    await recordRegistrationSecurityEvent(registrationSession, 'payment_verified', req, {
      reference,
      provider,
      plan_id: plan.id,
      duration_months: durationMonths,
      amount: paymentResult.amount || null,
      billing_kind: metadata.billing_kind || metadata.billingKind || billingIntent?.type || null
    });
    await recordRegistrationSecurityEvent(registrationSession, 'registration_completed', req, {
      plan_id: plan.id,
      completion_source: 'payment_verify'
    });

    res.json({
      success: true,
      data: {
        subscription: subscriptionResult.subscription,
        duration_months: durationMonths,
        message: `Subscription to ${plan.name} activated successfully`
      }
    });
  } catch (error) {
    logger.error('Payment verification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get payment methods
 * GET /payment/methods
 */
router.get('/methods', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'paystack',
        name: 'Paystack',
        description: 'Card and Mobile Money (MTN, Vodafone, AirtelTigo)',
        supportedCurrencies: ['GHS'],
        fees: '1.5%'
      },
      {
        id: 'momo',
        name: 'Mobile Money',
        description: 'Direct Mobile Money payment (MTN, Vodafone, AirtelTigo)',
        supportedCurrencies: ['GHS'],
        fees: '1%'
      }
    ]
  });
});

/**
 * Get banks for payout setup
 * GET /payment/banks
 */
router.get('/banks', async (req, res) => {
  try {
    const banks = await paymentService.getBanks();
    res.json({
      success: true,
      data: banks
    });
  } catch (error) {
    logger.error('Error fetching banks:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Setup contributor payout account
 * POST /payment/payout-account
 */
router.post('/payout-account', authenticate, async (req, res) => {
  try {
    const { bankCode, accountNumber, accountName } = req.body;
    const user = req.user;

    // Create transfer recipient
    const recipientResult = await paymentService.createTransferRecipient({
      name: accountName,
      bankCode,
      accountNumber
    });

    if (!recipientResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to setup payout account'
      });
    }

    // Store recipient code in user profile
    user.payout_recipient_code = recipientResult.recipientCode;
    await user.save();

    res.json({
      success: true,
      data: {
        recipientCode: recipientResult.recipientCode,
        message: 'Payout account setup successfully'
      }
    });
  } catch (error) {
    logger.error('Payout account setup error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Paystack webhook
 * POST /payment/webhook/paystack
 */
router.post('/webhook/paystack', async (req, res) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!secret || !signature || !req.rawBody) {
      logger.warn('Paystack webhook missing signature or secret');
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
        const matchedUser = await findUserByPaymentCustomerEmail(customerEmail);
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

      if (!userId || !planId || !plan) {
        logger.warn('Skipped Paystack webhook activation: missing user/plan mapping');
      } else {
        const paidAmount = payload.amount ? Number(payload.amount) / 100 : null;
        const metadataTotalAmount = Number(metadata.totalAmount ?? metadata.total_amount);
        const expectedAmount = Number.isFinite(metadataTotalAmount)
          ? Number(metadataTotalAmount.toFixed(2))
          : Number((Number(plan.price || 0) * durationMonths).toFixed(2));
        if (paidAmount != null && paidAmount + 0.01 < expectedAmount) {
          logger.warn(`Skipped Paystack webhook activation: paid amount below expected amount (${paidAmount} < ${expectedAmount})`);
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
              payment_verified_via: 'payment_webhook'
            }
          });
          await recordRegistrationSecurityEvent(registrationSession, 'payment_verified', req, {
            reference: payload.reference,
            provider: 'paystack',
            plan_id: planId,
            duration_months: durationMonths,
            source: 'payment_webhook'
          });
          await recordRegistrationSecurityEvent(registrationSession, 'registration_completed', req, {
            plan_id: planId,
            completion_source: 'payment_webhook'
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

    res.sendStatus(200);
  } catch (error) {
    logger.error('Paystack webhook error:', error);
    res.sendStatus(500);
  }
});

module.exports = router;
