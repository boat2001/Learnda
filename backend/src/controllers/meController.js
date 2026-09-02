const {
  User,
  Subscription,
  Plan,
  PlanFeature,
  AcademicProfile,
  LearningPathway,
  UserContact
} = require('../models');
const { Op } = require('sequelize');
const subscriptionService = require('../services/subscriptionService');
const {
  registrationStageFromOnboardingStep,
  updateRegistrationSessionForUser,
  recordRegistrationSecurityEvent
} = require('../services/registrationSessionService');
const { maybeAdvanceAcademicProgress } = require('../utils/academicProgression');
const {
  LEVEL_GROUPS,
  CLASS_LEVEL_CODES,
  ACADEMIC_TERMS,
  ACADEMIC_PROFILE_STATUSES,
  normalizeClassLevelCode,
  isBannedClassCode,
  getClassLevel,
  getLevelGroup,
  getAcademicYearLabel,
} = require('../config/educationStructure');
const { normalizeEmailAddress, normalizePhoneNumber } = require('../utils/contact');
const {
  buildOnboardingState,
  persistOnboardingState,
  serializeAuthUser,
  getAcademicProfile,
  ONBOARDING_STEPS,
  PLAN_STATUSES
} = require('../utils/onboarding');
const {
  BILLING_INTENT_TYPES,
  buildBillingIntent,
  getBillingIntent,
  isBillingIntentExpired,
  setBillingIntentOnPreferences
} = require('../utils/billingIntent');

const getActiveSubscription = async (userId) => Subscription.findOne({
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
  ],
  order: [['created_at', 'DESC']]
});

// Tells a learner they have moved up a class, once, after the academic year
// turns (§6.4). Suppressed after acknowledgement so it does not nag.
const buildPromotionNotice = (user) => {
  const profile = user?.academic_profile;
  if (!profile || !profile.promoted_at) return null;

  const classLevel = getClassLevel(profile.class_level);
  if (!classLevel) return null;

  const noticeKey = `promotion:${profile.class_level}:${profile.academic_year}`;
  const preferences = user.preferences && typeof user.preferences === 'object' ? user.preferences : {};
  if (preferences.promotion_notice_seen_key === noticeKey) return null;

  return {
    key: noticeKey,
    type: 'class_promotion',
    class_level: profile.class_level,
    class_label: classLevel.label,
    academic_year: profile.academic_year,
    promoted_at: profile.promoted_at,
    title: `Welcome to ${classLevel.label}`,
    message: `A new school year has started, so your lessons and practice now come from ${classLevel.label}. `
           + 'Everything from your earlier classes stays open for revision.'
  };
};

const buildFeatureFlags = (plan) => {
  const features = Array.isArray(plan?.features) ? plan.features : [];
  return features.reduce((acc, feature) => {
    acc[feature.feature_key] = Boolean(feature.enabled);
    return acc;
  }, {});
};

const buildMeResponse = (user, onboarding, subscription, selectedPlan, billingIntent = null, promotionNotice = null) => {
  const activePlan = subscription?.plan || null;
  const featureFlags = buildFeatureFlags(activePlan);
  const academicProfile = getAcademicProfile(user);
  const primaryContact = user?.primary_contact
    ? {
      id: user.primary_contact.id,
      type: user.primary_contact.contact_type,
      value: user.primary_contact.contact_value,
      is_verified: user.primary_contact.is_verified
    }
    : null;

  return {
    success: true,
    user: {
      ...serializeAuthUser(user, onboarding),
      phone_number: user.phone_number,
      country_code: user.country_code,
      current_plan: user.current_plan,
      academic_profile: academicProfile,
      primary_contact: primaryContact,
      active_plan: activePlan,
      selected_plan: selectedPlan,
      billing_intent: billingIntent,
      promotion_notice: promotionNotice,
      subscription,
      feature_flags: featureFlags
    },
    next_step: onboarding.next_step
  };
};

const maybePersistAcademicProgression = async (user) => {
  const profile = user?.academic_profile;
  if (!profile || typeof profile.update !== 'function') return;

  const advance = maybeAdvanceAcademicProgress(profile.get({ plain: true }));
  if (!advance) return;

  const { needs_review: needsReview, years_elapsed: yearsElapsed, ...patch } = advance;
  if (needsReview) {
    patch.metadata = {
      ...(profile.metadata || {}),
      needs_progression_review: true,
      years_elapsed: yearsElapsed
    };
  }
  await profile.update(patch);
};

const PHONE_REGEX = /^(?:\+?[1-9]\d{7,14}|0\d{9})$/;

const normalizeContactValue = (type, value) => (
  type === 'email'
    ? normalizeEmailAddress(value)
    : normalizePhoneNumber(value)
);

const syncUserContacts = async (user) => {
  if (!user?.id) return null;

  const desiredContacts = [];
  const email = String(user.email || '').trim();
  const phoneNumber = normalizePhoneNumber(user.phone_number || '');

  if (email) {
    desiredContacts.push({
      type: 'email',
      value: email,
      normalized: normalizeContactValue('email', email),
      isVerified: Boolean(user.email_verified)
    });
  }

  if (phoneNumber) {
    desiredContacts.push({
      type: 'phone',
      value: phoneNumber,
      normalized: normalizeContactValue('phone', phoneNumber),
      isVerified: Boolean(user.phone_verified)
    });
  }

  if (!desiredContacts.length) return null;

  const existingContacts = await UserContact.findAll({
    where: { user_id: user.id },
    order: [['created_at', 'ASC']]
  });

  const existingByType = new Map(existingContacts.map((contact) => [contact.contact_type, contact]));
  const primaryType = phoneNumber ? 'phone' : 'email';
  let primaryContactId = user.primary_contact_id || null;
  let primaryContactRecord = null;

  for (const contact of desiredContacts) {
    const existing = existingByType.get(contact.type);
    if (existing) {
      await existing.update({
        contact_value: contact.value,
        normalized_value: contact.normalized,
        is_primary: contact.type === primaryType,
        is_verified: contact.isVerified,
        verified_at: contact.isVerified ? (existing.verified_at || new Date()) : null
      });
      if (contact.type === primaryType) {
        primaryContactId = existing.id;
        primaryContactRecord = existing;
      }
      continue;
    }

    const created = await UserContact.create({
      user_id: user.id,
      contact_type: contact.type,
      contact_value: contact.value,
      normalized_value: contact.normalized,
      is_primary: contact.type === primaryType,
      is_verified: contact.isVerified,
      verified_at: contact.isVerified ? new Date() : null
    });

    if (contact.type === primaryType) {
      primaryContactId = created.id;
      primaryContactRecord = created;
    }
  }

  if (primaryContactId && String(user.primary_contact_id || '') !== String(primaryContactId)) {
    await user.update({ primary_contact_id: primaryContactId });
    user.primary_contact_id = primaryContactId;
  }

  if (primaryContactRecord) {
    user.primary_contact = primaryContactRecord;
  }

  return primaryContactRecord;
};

const resolveBillingIntent = async (user) => {
  if (!user) return null;
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

const syncRegistrationSessionFromOnboarding = async (user, onboarding, updates = {}) => {
  const stage = updates.stage || registrationStageFromOnboardingStep(onboarding?.next_step);
  return updateRegistrationSessionForUser(user, {
    ...updates,
    stage
  });
};

module.exports = {
  async getMe(req, res) {
    try {
      const user = await User.findByPk(req.user.id, {
        include: [
          {
            model: AcademicProfile,
            as: 'academic_profile',
            required: false
          },
          {
            model: UserContact,
            as: 'primary_contact',
            required: false
          }
        ]
      });
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      await syncUserContacts(user);
      await maybePersistAcademicProgression(user);

      const subscription = await getActiveSubscription(user.id);
      const selectedPlan = user.selected_plan_id
        ? await Plan.findByPk(user.selected_plan_id)
        : (subscription?.plan || null);
      const onboarding = buildOnboardingState(user, {
        selectedPlan,
        activeSubscription: subscription
      });

      await persistOnboardingState(user, onboarding);
      await syncRegistrationSessionFromOnboarding(user, onboarding);
      const billingIntent = await resolveBillingIntent(user);
      return res.json(buildMeResponse(user, onboarding, subscription, selectedPlan, billingIntent, buildPromotionNotice(user)));
    } catch (error) {
      console.error('Get /me error:', error);
      return res.status(500).json({ success: false, error: 'Failed to load session' });
    }
  },

  // Profile details a learner may edit freely. Class placement is deliberately
  // NOT here -- see setClassPlacement (§1.4).
  async updateProfile(req, res) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      const wasProfileComplete = Boolean(user.profile_complete);
      const { full_name, avatar_url } = req.body || {};

      const updates = {};

      if (full_name !== undefined) {
        const trimmed = String(full_name || '').trim();
        if (!trimmed) {
          return res.status(400).json({ success: false, error: 'Name cannot be empty.' });
        }
        if (trimmed.length > 255) {
          return res.status(400).json({ success: false, error: 'Name is too long.' });
        }
        updates.full_name = trimmed;
      }

      if (avatar_url !== undefined) {
        updates.avatar_url = avatar_url ? String(avatar_url).trim() : null;
      }

      // §1.4: reject rather than silently ignore, so a client sending class
      // changes here learns it is the wrong door.
      const PLACEMENT_FIELDS = ['class_level', 'level_group', 'academic_year', 'term', 'pathway_id', 'status', 'auto_progression'];
      const attempted = PLACEMENT_FIELDS.filter((f) => Object.prototype.hasOwnProperty.call(req.body || {}, f));
      if (attempted.length) {
        return res.status(403).json({
          success: false,
          error: 'Your class level is set by your school year and cannot be changed here.'
        });
      }

      if (!Object.keys(updates).length) {
        return res.status(400).json({ success: false, error: 'Nothing to update.' });
      }

      await user.update(updates);

      const onboarding = buildOnboardingState(user);
      await persistOnboardingState(user, onboarding);

      const subscription = await getActiveSubscription(user.id);
      const selectedPlan = user.selected_plan_id
        ? await Plan.findByPk(user.selected_plan_id)
        : null;

      const registrationSession = await syncRegistrationSessionFromOnboarding(user, onboarding, {
        full_name: updates.full_name || user.full_name || null
      });
      if (!wasProfileComplete && user.profile_complete) {
        await recordRegistrationSecurityEvent(registrationSession, 'profile_saved', req, {
          full_name: Boolean(updates.full_name)
        });
      }

      const billingIntent = await resolveBillingIntent(user);
      return res.json(buildMeResponse(user, onboarding, subscription, selectedPlan, billingIntent, buildPromotionNotice(user)));
    } catch (error) {
      console.error('PATCH /me/profile error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
  },

  // Initial class placement only. §1.4 and §6.4: once a learner has a class,
  // they cannot move it themselves -- promotion happens when the academic year
  // turns, and corrections go through an audited admin/parent override (§6.5).
  async setClassPlacement(req, res) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const { class_level, pathway_id, is_stem_school } = req.body || {};
      const normalizedClassLevel = normalizeClassLevelCode(class_level);

      if (!normalizedClassLevel) {
        return res.status(400).json({
          success: false,
          error: isBannedClassCode(class_level)
            ? 'Primary classes are Basic 1-6 (B1-B6). Use a Basic class code.'
            : `class_level must be one of: ${CLASS_LEVEL_CODES.join(', ')}`
        });
      }

      const existing = await AcademicProfile.findOne({ where: { user_id: user.id } });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Your class is already set. It moves up automatically each school year. '
               + 'If it is wrong, ask a parent or administrator to correct it.',
          class_level: existing.class_level
        });
      }

      const levelGroup = getLevelGroup(normalizedClassLevel);

      // §4.4: SHS learners must declare a pathway; nobody else may have one.
      if (levelGroup === LEVEL_GROUPS.SHS && !pathway_id) {
        return res.status(400).json({
          success: false,
          error: 'Choose your learning area / pathway to see your SHS subjects.'
        });
      }
      if (levelGroup !== LEVEL_GROUPS.SHS && pathway_id) {
        return res.status(400).json({
          success: false,
          error: 'Learning pathways apply to SHS learners only.'
        });
      }

      // A STEM pathway is only selectable at a designated STEM school (§4.4.9).
      if (pathway_id) {
        const pathway = await LearningPathway.findByPk(pathway_id);
        if (!pathway || !pathway.is_active) {
          return res.status(400).json({ success: false, error: 'Selected pathway is invalid.' });
        }
        if (pathway.is_stem_only && !is_stem_school) {
          return res.status(400).json({
            success: false,
            error: 'The STEM pathway is available only at designated STEM schools.'
          });
        }
      }

      const profile = await AcademicProfile.create({
        user_id: user.id,
        class_level: normalizedClassLevel,
        level_group: levelGroup,
        academic_year: getAcademicYearLabel(),
        term: ACADEMIC_TERMS[0],
        status: ACADEMIC_PROFILE_STATUSES.ACTIVE,
        auto_progression: true,
        pathway_id: levelGroup === LEVEL_GROUPS.SHS ? pathway_id : null,
        is_stem_school: Boolean(is_stem_school)
      });

      return res.json({
        success: true,
        academic_profile: {
          class_level: profile.class_level,
          level_group: profile.level_group,
          academic_year: profile.academic_year,
          term: profile.term,
          pathway_id: profile.pathway_id
        }
      });
    } catch (error) {
      console.error('PUT /me/class-placement error:', error);
      return res.status(500).json({ success: false, error: 'Failed to set your class.' });
    }
  },

  async markPromotionNoticeSeen(req, res) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const noticeKey = String(req.body?.key || '').trim();
      if (!noticeKey) {
        return res.status(400).json({ success: false, error: 'Notice key is required.' });
      }

      const preferences = user.preferences && typeof user.preferences === 'object' ? user.preferences : {};
      await user.update({
        preferences: {
          ...preferences,
          promotion_notice_seen_key: noticeKey,
          promotion_notice_seen_at: new Date().toISOString()
        }
      });

      return res.json({ success: true });
    } catch (error) {
      console.error('POST /me/promotion-notice/seen error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update notice state.' });
    }
  },

  async selectPlan(req, res) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const isAdmin = user.role === 'admin';

      if (!isAdmin && !user.profile_complete) {
        return res.status(400).json({
          success: false,
          error: 'Complete profile before selecting a plan'
        });
      }
      if (!isAdmin && !user.password_set) {
        return res.status(400).json({
          success: false,
          error: 'Create a password before selecting a plan'
        });
      }

      const planId = req.body?.plan_id;
      if (!planId) {
        return res.status(400).json({ success: false, error: 'plan_id is required' });
      }

      const plan = await Plan.findByPk(planId);
      if (!plan || !plan.is_active) {
        return res.status(404).json({ success: false, error: 'Plan not found' });
      }

      const activeSubscription = await getActiveSubscription(user.id);
      const planPrice = Number(plan.price || 0);
      if (isAdmin) {
        const nextPreferences = setBillingIntentOnPreferences(user.preferences, null);
        await subscriptionService.activatePlanDirect(user.id, plan.id, {
          payment_method: 'admin_override',
          payment_reference: `admin-${Date.now()}`
        });
        await user.update({ preferences: nextPreferences });
      } else if (planPrice <= 0) {
        const nextPreferences = setBillingIntentOnPreferences(user.preferences, null);
        await subscriptionService.handleFreePlan(user.id, plan.id, activeSubscription);
        await user.update({ preferences: nextPreferences });
      } else if (activeSubscription) {
        const activePlan = activeSubscription.plan || await Plan.findByPk(activeSubscription.plan_id);
        const activePlanPrice = Number(activePlan?.price || 0);
        const isSamePlan = activePlan && String(activePlan.id) === String(plan.id);
        const isDowngrade = !isSamePlan && planPrice < activePlanPrice;

        if (isDowngrade) {
          return res.status(400).json({
            success: false,
            error: 'Downgrades are applied at cycle end. Keep current plan or choose a higher plan.'
          });
        }

        const billingIntent = buildBillingIntent({
          planId: plan.id,
          type: isSamePlan ? BILLING_INTENT_TYPES.RENEWAL : BILLING_INTENT_TYPES.UPGRADE,
          fromPlanId: activePlan?.id || null,
          ttlMinutes: 45
        });
        const nextPreferences = setBillingIntentOnPreferences(user.preferences, billingIntent);

        await user.update({
          selected_plan_id: activePlan?.id || user.selected_plan_id || null,
          plan_status: PLAN_STATUSES.ACTIVE,
          onboarding_step: ONBOARDING_STEPS.DONE,
          preferences: nextPreferences
        });
      } else {
        const nextPreferences = setBillingIntentOnPreferences(user.preferences, null);
        await user.update({
          selected_plan_id: plan.id,
          plan_status: PLAN_STATUSES.PENDING_PAYMENT,
          onboarding_step: ONBOARDING_STEPS.PAYMENT,
          preferences: nextPreferences
        });
      }

      const freshUser = await User.findByPk(user.id);
      const subscription = await getActiveSubscription(user.id);
      const selectedPlan = freshUser.selected_plan_id
        ? await Plan.findByPk(freshUser.selected_plan_id)
        : (subscription?.plan || null);
      const onboarding = buildOnboardingState(freshUser, {
        selectedPlan,
        activeSubscription: subscription
      });

      await persistOnboardingState(freshUser, onboarding);
      const registrationSession = await syncRegistrationSessionFromOnboarding(freshUser, onboarding, {
        selected_plan_id: selectedPlan?.id || null,
        metadata: {
          selected_plan_name: selectedPlan?.name || null,
          selected_plan_price: Number(selectedPlan?.price || 0),
          plan_status: freshUser.plan_status
        }
      });
      await recordRegistrationSecurityEvent(registrationSession, 'plan_selected', req, {
        plan_id: selectedPlan?.id || null,
        plan_name: selectedPlan?.name || null,
        price: Number(selectedPlan?.price || 0),
        plan_status: freshUser.plan_status
      });
      if (onboarding.next_step === ONBOARDING_STEPS.DONE) {
        await recordRegistrationSecurityEvent(registrationSession, 'registration_completed', req, {
          plan_id: selectedPlan?.id || null,
          completion_source: 'free_plan_or_existing_subscription'
        });
      }
      const billingIntent = await resolveBillingIntent(freshUser);

      return res.json(buildMeResponse(freshUser, onboarding, subscription, selectedPlan, billingIntent));
    } catch (error) {
      console.error('POST /me/select-plan error:', error);
      return res.status(500).json({ success: false, error: 'Failed to select plan' });
    }
  },

  async updatePassword(req, res) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }

      const password = req.body?.password;
      if (typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters'
        });
      }

      await user.update({
        password_hash: password,
        password_set: true
      });

      const subscription = await getActiveSubscription(user.id);
      const selectedPlan = user.selected_plan_id
        ? await Plan.findByPk(user.selected_plan_id)
        : (subscription?.plan || null);
      const onboarding = buildOnboardingState(user, {
        selectedPlan,
        activeSubscription: subscription
      });

      await persistOnboardingState(user, onboarding);
      const registrationSession = await syncRegistrationSessionFromOnboarding(user, onboarding, {
        password_hash: user.password_hash,
        metadata: {
          password_set_via: 'me.password'
        }
      });
      await recordRegistrationSecurityEvent(registrationSession, 'password_set', req, {
        source: 'me.password'
      });
      const billingIntent = await resolveBillingIntent(user);
      return res.json(buildMeResponse(user, onboarding, subscription, selectedPlan, billingIntent, buildPromotionNotice(user)));
    } catch (error) {
      console.error('PATCH /me/password error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update password' });
    }
  }
};
