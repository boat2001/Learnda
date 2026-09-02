// services/paymentService.js
const logger = require('../config/logger');
const config = require('../config/env');

const normalizeKey = (value) => String(value || '')
  .toLowerCase()
  .replace(/[_-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const parseJsonObject = (input) => {
  if (!input || typeof input !== 'string') return {};
  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    logger.warn('Invalid PAYSTACK_PLAN_CODE_MAP JSON. Falling back to empty mapping.');
    return {};
  }
};

const requestJson = async (url, { method = 'GET', headers = {}, body } = {}) => {
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = payload?.error || payload?.message || payload || 'Request failed';
    const error = new Error(message);
    error.response = { status: response.status, data: payload };
    throw error;
  }

  return payload;
};

class PaymentService {
  constructor() {
    this.paystackKey = process.env.PAYSTACK_SECRET_KEY;
    this.paystackBaseUrl = 'https://api.paystack.co';
    this.paystackPlanCodeMap = parseJsonObject(process.env.PAYSTACK_PLAN_CODE_MAP);
    this.paystackChargePercent = Number(config.payment?.paystackChargePercent || 0);
    this.paystackChargeFlat = Number(config.payment?.paystackChargeFlat || 0);
    this.paystackChargeCap = Number(config.payment?.paystackChargeCap || 0);
  }

  roundCurrency(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  calculateCustomerCharge(baseAmount, currency = 'GHS') {
    const normalizedBaseAmount = this.roundCurrency(baseAmount);
    if (normalizedBaseAmount <= 0) {
      return {
        baseAmount: 0,
        feeAmount: 0,
        totalAmount: 0,
        currency: String(currency || 'GHS').toUpperCase()
      };
    }

    let feeAmount = this.roundCurrency(
      normalizedBaseAmount * (Math.max(0, this.paystackChargePercent) / 100) +
      Math.max(0, this.paystackChargeFlat)
    );

    if (this.paystackChargeCap > 0) {
      feeAmount = Math.min(feeAmount, this.paystackChargeCap);
    }

    return {
      baseAmount: normalizedBaseAmount,
      feeAmount: this.roundCurrency(feeAmount),
      totalAmount: this.roundCurrency(normalizedBaseAmount + feeAmount),
      currency: String(currency || 'GHS').toUpperCase()
    };
  }

  /**
   * Initialize payment for subscription
   * @param {Object} paymentData - { userId, planId, amount, currency, email, paymentMethod }
   * @returns {Object} - { reference, authorizationUrl or clientSecret }
   */
  async initializePayment(paymentData) {
    const {
      userId,
      planId,
      plan = null,
      amount,
      amountBreakdown = null,
      metadata = {},
      callbackUrl = null,
      durationMonths = 1,
      currency = 'GHS',
      email,
      phone = null,
      paymentMethod = 'paystack'
    } = paymentData;

    if (paymentMethod === 'paystack') {
      return this.initializePaystackPayment({
        userId,
        planId,
        plan,
        amount,
        amountBreakdown,
        metadata,
        callbackUrl,
        durationMonths,
        currency,
        email
      });
    } else if (paymentMethod === 'momo') {
      return this.initializeMoMoPayment({
        userId,
        planId,
        plan,
        amount,
        amountBreakdown,
        metadata,
        callbackUrl,
        durationMonths,
        currency,
        email,
        phone
      });
    }

    throw new Error('Unsupported payment method');
  }

  /**
   * Direct payment processing is not supported in the API layer.
   * Use /payment/initialize to start a provider flow, then /payment/verify or webhooks to confirm.
   */
  async processPayment() {
    return {
      success: false,
      error: 'Direct payment processing is not supported. Use /payment/initialize.'
    };
  }

  /**
   * Initialize Paystack payment
   */
  async initializePaystackPayment({
    userId,
    planId,
    plan,
    amount,
    amountBreakdown = null,
    metadata = {},
    callbackUrl = null,
    durationMonths = 1,
    currency,
    email
  }) {
    try {
      if (!this.paystackKey) {
        throw new Error('PAYSTACK_SECRET_KEY is not configured');
      }

      const callbackBase = (config.app?.publicUrl || '').replace(/\/$/, '');
      const resolvedCallbackUrl = String(callbackUrl || '').trim() || (callbackBase ? `${callbackBase}/` : undefined);
      const normalizedDurationMonths = Number.parseInt(durationMonths, 10) || 1;
      const paystackPlanCode = this.resolvePaystackPlanCode(plan);
      const chargeBreakdown = amountBreakdown || this.calculateCustomerCharge(amount, currency);
      const billingKind = String(metadata?.billing_kind || metadata?.billingKind || '').trim().toLowerCase();
      const planAmount = this.roundCurrency(plan?.price);
      const chargeAmount = this.roundCurrency(amount);
      const isStandardMonthlySubscription = (
        normalizedDurationMonths === 1 &&
        (!billingKind || billingKind === 'new_subscription') &&
        chargeAmount === planAmount
      );
      const shouldAttachPlanCode = Boolean(paystackPlanCode) && isStandardMonthlySubscription;
      const response = await requestJson(
        `${this.paystackBaseUrl}/transaction/initialize`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackKey}`,
            'Content-Type': 'application/json'
          },
          method: 'POST',
          body: {
            email,
            amount: Math.round(amount * 100), // Amount in kobo/pesewas
            currency,
            metadata: {
              userId,
              planId,
              durationMonths: normalizedDurationMonths,
              duration_months: normalizedDurationMonths,
              baseAmount: chargeBreakdown.baseAmount,
              feeAmount: chargeBreakdown.feeAmount,
              totalAmount: chargeBreakdown.totalAmount,
              paystackPlanCode: paystackPlanCode || null,
              type: 'subscription',
              ...metadata
            },
            ...(shouldAttachPlanCode ? { plan: paystackPlanCode } : {}),
            callback_url: resolvedCallbackUrl
          }
        }
      );

      if (response.status) {
        return {
          success: true,
          reference: response.data.reference,
          authorizationUrl: response.data.authorization_url,
          accessCode: response.data.access_code,
          amountBreakdown: chargeBreakdown,
          recurring: Boolean(shouldAttachPlanCode),
          paystackPlanCode: paystackPlanCode || null,
          provider: 'paystack'
        };
      }
      throw new Error('Failed to initialize Paystack payment');
    } catch (error) {
      logger.error('Paystack initialization error:', error);
      throw error;
    }
  }

  /**
   * Initialize MoMo payment (MTN, Vodafone, AirtelTigo)
   */
  async initializeMoMoPayment({
    userId,
    planId,
    plan,
    amount,
    amountBreakdown = null,
    metadata = {},
    callbackUrl = null,
    durationMonths = 1,
    currency,
    email
  }) {
    try {
      // Using Paystack as intermediary for MoMo in Africa
      // Or use direct MoMo API integration if available
      return await this.initializePaystackPayment({
        userId,
        planId,
        plan,
        amount,
        amountBreakdown,
        metadata,
        callbackUrl,
        durationMonths,
        currency,
        email
      });
    } catch (error) {
      logger.error('MoMo initialization error:', error);
      throw error;
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(reference, provider = 'paystack') {
    if (provider === 'paystack') {
      return this.verifyPaystackPayment(reference);
    }
    throw new Error('Unsupported provider');
  }

  /**
   * Verify Paystack payment
   */
  async verifyPaystackPayment(reference) {
    try {
      if (!this.paystackKey) {
        throw new Error('PAYSTACK_SECRET_KEY is not configured');
      }

      const response = await requestJson(
        `${this.paystackBaseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackKey}`
          }
        }
      );

      if (response.status && response.data?.status === 'success') {
        const transaction = response.data || {};
        return {
          success: true,
          status: 'success',
          reference: transaction.reference || reference,
          amount: Number(transaction.amount || 0) / 100,
          currency: transaction.currency,
          metadata: transaction.metadata || {},
          transactionId: transaction.id,
          paidAt: transaction.paid_at,
          customerEmail: transaction.customer?.email || null,
          customerCode: transaction.customer?.customer_code || null,
          authorizationCode: transaction.authorization?.authorization_code || null,
          gatewayResponse: transaction.gateway_response || null,
          planCode: transaction.plan_object?.plan_code || transaction.plan || null,
          channel: transaction.channel || null
        };
      }

      return {
        success: false,
        status: response.data?.status
      };
    } catch (error) {
      logger.error('Paystack verification error:', error);
      throw error;
    }
  }

  /**
   * Process contributor payout
   * @param {Object} payoutData - { contributorId, amount, bankDetails, currency }
   */
  async processContributorPayout(payoutData) {
    const { contributorId, amount, bankDetails, currency = 'GHS' } = payoutData;

    try {
      if (!this.paystackKey) {
        throw new Error('PAYSTACK_SECRET_KEY is not configured');
      }

      // Initialize transfer using Paystack or direct bank transfer
      const response = await requestJson(
        `${this.paystackBaseUrl}/transfer`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackKey}`,
            'Content-Type': 'application/json'
          },
          method: 'POST',
          body: {
            source: 'balance', // From account balance
            recipient: bankDetails.recipientCode, // Previously created transfer recipient
            amount: Math.round(amount * 100),
            currency,
            reason: `Sharether contributor earnings - Contributor ID: ${contributorId}`
          }
        }
      );

      if (response.status) {
        return {
          success: true,
          transferId: response.data.id,
          status: response.data.status,
          amount: response.data.amount / 100,
          currency
        };
      }

      throw new Error('Failed to process payout');
    } catch (error) {
      logger.error('Payout processing error:', error);
      throw error;
    }
  }

  /**
   * Create transfer recipient for contributor
   */
  async createTransferRecipient(contributorData) {
    const { name, bankCode, accountNumber, accountType = 'nuban' } = contributorData;

    try {
      if (!this.paystackKey) {
        throw new Error('PAYSTACK_SECRET_KEY is not configured');
      }

      const response = await requestJson(
        `${this.paystackBaseUrl}/transferrecipient`,
        {
          headers: {
            Authorization: `Bearer ${this.paystackKey}`,
            'Content-Type': 'application/json'
          },
          method: 'POST',
          body: {
            type: accountType,
            name,
            account_number: accountNumber,
            bank_code: bankCode
          }
        }
      );

      if (response.status) {
        return {
          success: true,
          recipientCode: response.data.recipient_code,
          id: response.data.id
        };
      }

      throw new Error('Failed to create transfer recipient');
    } catch (error) {
      logger.error('Transfer recipient creation error:', error);
      throw error;
    }
  }

  /**
   * Get list of banks (for recipient selection)
   */
  async getBanks() {
    try {
      if (!this.paystackKey) {
        throw new Error('PAYSTACK_SECRET_KEY is not configured');
      }

      const response = await requestJson(
        `${this.paystackBaseUrl}/bank?country=NG`, // or appropriate country
        {
          headers: {
            Authorization: `Bearer ${this.paystackKey}`
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Error fetching banks:', error);
      throw error;
    }
  }

  resolvePaystackPlanCode(plan) {
    if (!plan) return null;

    if (plan.paystack_plan_code) {
      return String(plan.paystack_plan_code).trim();
    }

    const keys = [
      plan.id,
      plan.name,
      normalizeKey(plan.name)
    ].filter(Boolean);

    for (const key of keys) {
      const value = this.paystackPlanCodeMap[key];
      if (value) return String(value).trim();
    }

    const normalizedKeys = keys.map((key) => normalizeKey(key));
    for (const [mapKey, mapValue] of Object.entries(this.paystackPlanCodeMap)) {
      if (normalizedKeys.includes(normalizeKey(mapKey)) && mapValue) {
        return String(mapValue).trim();
      }
    }

    return null;
  }

  resolvePlanIdentifierFromPaystackCode(paystackPlanCode) {
    const normalizedCode = String(paystackPlanCode || '').trim();
    if (!normalizedCode) return null;

    for (const [identifier, code] of Object.entries(this.paystackPlanCodeMap)) {
      if (String(code).trim() === normalizedCode) {
        return identifier;
      }
    }

    return null;
  }
}

module.exports = new PaymentService();
