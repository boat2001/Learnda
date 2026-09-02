const {
  User,
  Subscription,
  Plan,
  PlanFeature,
  Institution,
  AcademicProfile,
  Program,
  UserContact
} = require('../models');
const { Op } = require('sequelize');
const subscriptionService = require('../services/subscriptionService');
const notificationService = require('../services/notificationService');
const config = require('../config/env');
const {
  registrationStageFromOnboardingStep,
  updateRegistrationSessionForUser,
  recordRegistrationSecurityEvent
} = require('../services/registrationSessionService');
const {
  normalizeLevel,
  normalizeSemester,
  maybeAdvanceAcademicProgress
} = require('../utils/academicProgression');
const {
  normalizeProgramCategory,
  validateStudentIndexNumber,
  getProgramCategoryCode
} = require('../utils/studentIdentity');
const { normalizeEmailAddress, normalizePhoneNumber } = require('../utils/contact');
const { getAcademicCatalog } = require('../services/academicCatalogService');
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

const buildAcademicStateNotice = async (user) => {
  if (!user || user.role !== 'student' || !user.institution_id) return null;

  const institution = await Institution.findByPk(user.institution_id, {
    attributes: ['id', 'name', 'metadata']
  });
  const academicState = institution?.metadata?.academic_state || null;
  if (!academicState || !academicState.applied_at) {
    return null;
  }

  const appliedAtMs = new Date(academicState.applied_at).getTime();
  const progressedAtMs = new Date(user.academic_last_progressed_at || 0).getTime();
  if (!Number.isFinite(appliedAtMs) || !Number.isFinite(progressedAtMs) || progressedAtMs < appliedAtMs) {
    return null;
  }

  const action = String(academicState.action || '');
  const currentSemester = String(academicState.current_semester || '');
  const userSemester = String(user.semester || '');
  const isSemesterSwitchNotice = action === 'semester_switch' && currentSemester === '2' && userSemester === '2';
  const isLevelUpgradeNotice = action === 'level_upgrade' && currentSemester === '1' && userSemester === '1';
  if (!isSemesterSwitchNotice && !isLevelUpgradeNotice) return null;

  const noticeKey = `academic-state:${institution.id}:${action}:${currentSemester}:${academicState.applied_at}`;
  const preferences = user.preferences && typeof user.preferences === 'object' ? user.preferences : {};
  if (preferences.academic_state_notice_seen_key === noticeKey) {
    return null;
  }

  const levelLabel = user.level ? `Level ${user.level}` : 'your new level';

  return {
    key: noticeKey,
    type: action,
    semester: currentSemester,
    level: user.level || null,
    institution_name: institution.name,
    applied_at: academicState.applied_at,
    title: isLevelUpgradeNotice ? `Welcome to ${levelLabel}` : 'Welcome to Semester 2',
    message: isLevelUpgradeNotice
      ? `${institution.name || 'Your college'} has moved to a new level, so we have moved your Sharether courses to ${levelLabel}, Semester 1. You can change your level or semester anytime in Settings.`
      : `${institution.name || 'Your college'} is now in Semester 2, so we have moved your Sharether courses to Semester 2 as well. You can switch back to Semester 1 anytime in Settings.`
  };
};

const buildFeatureFlags = (plan) => {
  const features = Array.isArray(plan?.features) ? plan.features : [];
  return features.reduce((acc, feature) => {
    acc[feature.feature_key] = Boolean(feature.enabled);
    return acc;
  }, {});
};

const syncAcademicColumnsFromProfile = async (user) => {
  const academicProfile = getAcademicProfile(user);
  const patch = {};

  if (
    academicProfile.programme_category &&
    String(user.programme_category || '') !== String(academicProfile.programme_category)
  ) {
    patch.programme_category = academicProfile.programme_category;
  }
  if (
    academicProfile.program_name &&
    String(user.program || '') !== String(academicProfile.program_name)
  ) {
    patch.program = academicProfile.program_name;
  }
  if (
    academicProfile.program_id &&
    String(user.program_id || '') !== String(academicProfile.program_id)
  ) {
    patch.program_id = academicProfile.program_id;
  }

  if (!Object.keys(patch).length) {
    return user;
  }

  await user.update(patch);
  Object.assign(user, patch);
  return user;
};

const buildMeResponse = (user, onboarding, subscription, selectedPlan, billingIntent = null, academicStateNotice = null) => {
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
      institution_id: user.institution_id,
      institution: user.institution,
      affiliate_university: user.affiliate_university,
      programme_category: user.programme_category || academicProfile.programme_category || null,
      program: academicProfile.program_name || user.program,
      program_id: user.program_id || academicProfile.program_id || null,
      level: user.level,
      semester: user.semester,
      phone_number: user.phone_number,
      country_code: user.country_code,
      index_number: user.index_number,
      current_plan: user.current_plan,
      academic_profile: academicProfile,
      primary_contact: primaryContact,
      active_plan: activePlan,
      selected_plan: selectedPlan,
      billing_intent: billingIntent,
      academic_state_notice: academicStateNotice,
      subscription,
      feature_flags: featureFlags
    },
    next_step: onboarding.next_step
  };
};

const maybePersistAcademicProgression = async (user) => {
  const nextAcademicState = maybeAdvanceAcademicProgress(user);
  if (!nextAcademicState) return;
  await user.update(nextAcademicState);
  Object.assign(user, nextAcademicState);
};

const PHONE_REGEX = /^(?:\+?[1-9]\d{7,14}|0\d{9})$/;
const GENERIC_STUDENT_IDENTIFIER_REGEX = /^[A-Z0-9][A-Z0-9/-]{3,39}$/;

const isUuidLike = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
const buildProgramKey = (programName, programCategory) => (
  `${String(programCategory || '').trim()}-${String(programName || '').trim()}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
);
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
            required: false,
            include: [
              {
                model: Program,
                as: 'program_record',
                required: false
              }
            ]
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
      await syncAcademicColumnsFromProfile(user);
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
      const academicStateNotice = await buildAcademicStateNotice(user);

      return res.json(buildMeResponse(user, onboarding, subscription, selectedPlan, billingIntent, academicStateNotice));
    } catch (error) {
      console.error('Get /me error:', error);
      return res.status(500).json({ success: false, error: 'Failed to load session' });
    }
  },

  async getAcademicCatalog(req, res) {
    try {
      const catalog = await getAcademicCatalog();
      return res.json({ success: true, data: catalog });
    } catch (error) {
      console.error('GET /me/academic-catalog error:', error);
      return res.status(500).json({ success: false, error: 'Failed to load academic catalog' });
    }
  },

  async updateProfile(req, res) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      const wasProfileComplete = Boolean(user.profile_complete);

      const {
        full_name,
        institution_id,
        institution,
        affiliate_university,
        program,
        academic_program,
        level,
        semester,
        index_number
      } = req.body || {};
      const effectiveRole = user.role || 'student';
      const existingAcademicProfile = getAcademicProfile(user);

      if (effectiveRole === 'student') {
        const hasFullName = Boolean(
          typeof full_name === 'string'
            ? full_name.trim()
            : user.full_name
        );
        const hasInstitution = Boolean(institution_id || (typeof institution === 'string' && institution.trim()));
        const hasAffiliateUniversity = Boolean(
          typeof affiliate_university === 'string'
            ? affiliate_university.trim()
            : user.affiliate_university
        );
        const hasProgram = Boolean(typeof program === 'string' && program.trim());
        const hasAcademicProgram = Boolean(
          typeof academic_program === 'string'
            ? academic_program.trim()
            : existingAcademicProfile.program_name
        );
        const hasLevel = Boolean(typeof level === 'string' && level.trim());
        const hasSemester = Boolean(typeof semester === 'string' && semester.trim());
        const hasIndexNumber = Boolean(
          typeof index_number === 'string'
            ? index_number.trim()
            : user.index_number
        );

        if (
          !hasFullName ||
          !hasInstitution ||
          !hasAffiliateUniversity ||
          !hasProgram ||
          !hasAcademicProgram ||
          !hasLevel ||
          !hasSemester ||
          !hasIndexNumber
        ) {
          return res.status(400).json({
            success: false,
            error: 'full_name, institution (or institution_id), affiliate_university, program, academic_program, level, semester and index_number are required for students'
          });
        }
      }

      const trimmedFullName = typeof full_name === 'string'
        ? full_name.trim()
        : String(user.full_name || '').trim();
      if (effectiveRole === 'student' && !trimmedFullName) {
        return res.status(400).json({
          success: false,
          error: 'Full name is required'
        });
      }

      const normalizedLevel = effectiveRole === 'student' ? normalizeLevel(level) : null;
      const normalizedProgram = effectiveRole === 'student'
        ? normalizeProgramCategory(program)
        : (typeof program === 'string' ? program.trim() : null);
      const normalizedSemester = effectiveRole === 'student'
        ? normalizeSemester(semester || config.academic.defaultSemester)
        : null;
      if (effectiveRole === 'student' && !normalizedSemester) {
        return res.status(400).json({
          success: false,
          error: 'Semester must be 1 or 2'
        });
      }
      if (effectiveRole === 'student' && !normalizedLevel) {
        return res.status(400).json({
          success: false,
          error: 'Level format is invalid'
        });
      }
      if (effectiveRole === 'student' && !normalizedProgram) {
        return res.status(400).json({
          success: false,
          error: 'Program category must be one of: Early Childhood Education, Primary Education, JHS Education'
        });
      }
      const normalizedAffiliateUniversity = effectiveRole === 'student'
        ? String(affiliate_university || user.affiliate_university || '').trim()
        : null;
      if (effectiveRole === 'student' && !normalizedAffiliateUniversity) {
        return res.status(400).json({
          success: false,
          error: 'Affiliate university is required'
        });
      }
      const normalizedPhone = normalizePhoneNumber(req.body?.phone_number || user.phone_number || '');
      if (normalizedPhone && !PHONE_REGEX.test(normalizedPhone)) {
        return res.status(400).json({
          success: false,
          error: 'Phone number format is invalid'
        });
      }

      let resolvedInstitutionId = institution_id || user.institution_id || null;
      let resolvedInstitutionName = institution || user.institution || null;
      let institutionRecord = null;
      if (resolvedInstitutionId) {
        institutionRecord = await Institution.findByPk(resolvedInstitutionId);
        if (!institutionRecord) {
          return res.status(400).json({
            success: false,
            error: 'Selected college is invalid'
          });
        }
        resolvedInstitutionName = institutionRecord.name;
      }

      const academicCatalog = effectiveRole === 'student'
        ? await getAcademicCatalog()
        : null;
      const selectedCollege = effectiveRole === 'student'
        ? academicCatalog?.colleges?.find((college) => String(college.id) === String(resolvedInstitutionId))
        : null;
      if (effectiveRole === 'student' && !selectedCollege) {
        return res.status(400).json({
          success: false,
          error: 'Selected college is invalid'
        });
      }
      if (
        effectiveRole === 'student' &&
        String(selectedCollege.affiliate_university || '') !== String(normalizedAffiliateUniversity || '')
      ) {
        return res.status(400).json({
          success: false,
          error: 'Affiliate university does not match the selected college'
        });
      }
      if (
        effectiveRole === 'student' &&
        !(selectedCollege.programme_categories || []).some(
          (category) => category.name === normalizedProgram
        )
      ) {
        return res.status(400).json({
          success: false,
          error: 'Program category is not offered by the selected college'
        });
      }

      const availablePrograms = effectiveRole === 'student'
        ? (academicCatalog?.programs_by_category?.[normalizedProgram] || [])
        : [];
      const trimmedAcademicProgram = effectiveRole === 'student'
        ? String(academic_program || existingAcademicProfile.program_name || '').trim()
        : '';
      if (effectiveRole === 'student' && !trimmedAcademicProgram) {
        return res.status(400).json({
          success: false,
          error: 'Program is required'
        });
      }
      if (
        effectiveRole === 'student' &&
        availablePrograms.length &&
        !availablePrograms.some(
          (item) => String(item.name || '').trim().toLowerCase() === trimmedAcademicProgram.toLowerCase()
        )
      ) {
        return res.status(400).json({
          success: false,
          error: 'Selected program is invalid for the chosen program category'
        });
      }

      const trimmedIndexNumber = effectiveRole === 'student'
        ? String(index_number || user.index_number || '').trim().toUpperCase()
        : null;
      let validatedStudentIdentifier = null;
      let studentIdentifierType = existingAcademicProfile.student_identifier_type || 'index_number';
      if (effectiveRole === 'student') {
        const looksLikeStructuredIndex = /^[A-Z]{2}CE\/[A-Z]{3}\/\d{2}\/\d{4,6}$/.test(trimmedIndexNumber);
        if (looksLikeStructuredIndex) {
          const indexValidation = validateStudentIndexNumber({
            indexNumber: trimmedIndexNumber,
            programCategory: normalizedProgram,
            institutionRecord,
            institutionName: resolvedInstitutionName
          });
          if (!indexValidation.valid) {
            return res.status(400).json({
              success: false,
              error: indexValidation.error
            });
          }
          validatedStudentIdentifier = indexValidation.normalizedIndexNumber;
          studentIdentifierType = 'index_number';
        } else if (!GENERIC_STUDENT_IDENTIFIER_REGEX.test(trimmedIndexNumber)) {
          return res.status(400).json({
            success: false,
            error: 'Provide a valid index number or application number'
          });
        }
        if (!validatedStudentIdentifier) {
          validatedStudentIdentifier = trimmedIndexNumber;
          studentIdentifierType = 'application_number';
        }

        const existingOwner = await User.findOne({
          where: {
            index_number: validatedStudentIdentifier,
            id: { [Op.ne]: user.id }
          }
        });
        if (existingOwner) {
          return res.status(409).json({
            success: false,
            error: 'Index number is already assigned to another account'
          });
        }
      }

      let resolvedProgramRecord = null;
      if (effectiveRole === 'student') {
        const selectedProgramOption = availablePrograms.find(
          (item) => String(item.name || '').trim().toLowerCase() === trimmedAcademicProgram.toLowerCase()
        ) || null;

        if (selectedProgramOption?.id && isUuidLike(selectedProgramOption.id)) {
          resolvedProgramRecord = await Program.findByPk(selectedProgramOption.id);
        }

        if (!resolvedProgramRecord) {
          resolvedProgramRecord = await Program.findOne({
            where: {
              name: trimmedAcademicProgram,
              category: normalizedProgram
            }
          });
        }

        if (!resolvedProgramRecord) {
          const [createdProgram] = await Program.findOrCreate({
            where: {
              key: buildProgramKey(trimmedAcademicProgram, normalizedProgram)
            },
            defaults: {
              name: trimmedAcademicProgram,
              category: normalizedProgram,
              institution_id: resolvedInstitutionId || null,
              metadata: {
                category: normalizedProgram,
                source: 'me.updateProfile'
              }
            }
          });
          resolvedProgramRecord = createdProgram;
        }
      }

      const academicStepChanged = effectiveRole === 'student' && (
        String(user.level || '') !== String(normalizedLevel || '') ||
        String(user.semester || '') !== String(normalizedSemester || '')
      );

      await user.update({
        role: user.role,
        institution_id: resolvedInstitutionId,
        institution: resolvedInstitutionName || null,
        affiliate_university: normalizedAffiliateUniversity || null,
        phone_number: normalizedPhone || null,
        programme_category: effectiveRole === 'student'
          ? normalizedProgram
          : (normalizedProgram || null),
        program: effectiveRole === 'student'
          ? (resolvedProgramRecord?.name || trimmedAcademicProgram || null)
          : (normalizedProgram || null),
        program_id: effectiveRole === 'student'
          ? (resolvedProgramRecord?.id || null)
          : null,
        level: normalizedLevel || null,
        semester: normalizedSemester || null,
        index_number: effectiveRole === 'student' ? validatedStudentIdentifier : null,
        full_name: trimmedFullName || null,
        preferences: effectiveRole === 'student'
          ? {
            ...(user.preferences && typeof user.preferences === 'object' ? user.preferences : {}),
            academic_profile: {
              ...existingAcademicProfile,
              program_name: trimmedAcademicProgram,
              program_category: normalizedProgram,
              program_category_code: getProgramCategoryCode(normalizedProgram),
              student_identifier_type: studentIdentifierType,
              college_id: resolvedInstitutionId,
              college_name: resolvedInstitutionName,
              affiliate_university: normalizedAffiliateUniversity,
              program_id: resolvedProgramRecord?.id || null
            }
          }
          : user.preferences,
        academic_last_progressed_at: effectiveRole === 'student'
          ? (academicStepChanged ? new Date() : user.academic_last_progressed_at)
          : null,
        profile_complete: true,
        onboarding_step: user.selected_plan_id
          ? user.onboarding_step
          : (user.password_set ? ONBOARDING_STEPS.PLAN : ONBOARDING_STEPS.PASSWORD)
      });

      if (effectiveRole === 'student' && resolvedProgramRecord) {
        await AcademicProfile.upsert({
          user_id: user.id,
          institution_id: resolvedInstitutionId,
          affiliate_university: normalizedAffiliateUniversity,
          programme_category: normalizedProgram,
          program_id: resolvedProgramRecord.id,
          level: normalizedLevel,
          semester: normalizedSemester,
          index_number: validatedStudentIdentifier,
          student_identifier_type: studentIdentifierType,
          metadata: {
            program_name: trimmedAcademicProgram,
            program_category_code: getProgramCategoryCode(normalizedProgram),
            college_id: resolvedInstitutionId,
            college_name: resolvedInstitutionName
          }
        });
      }

      await syncUserContacts(user);

      const subscription = await getActiveSubscription(user.id);
      const selectedPlan = user.selected_plan_id
        ? await Plan.findByPk(user.selected_plan_id)
        : (subscription?.plan || null);
      const onboarding = buildOnboardingState(user, {
        selectedPlan,
        activeSubscription: subscription
      });

      await persistOnboardingState(user, onboarding);
      if (effectiveRole === 'student' && !wasProfileComplete && user.profile_complete) {
        try {
          await notificationService.createWelcomeNotification(user);
        } catch (notificationError) {
          console.error('Welcome notification error:', notificationError);
        }
      }
      const registrationSession = await syncRegistrationSessionFromOnboarding(user, onboarding, effectiveRole === 'student'
        ? {
          full_name: trimmedFullName || null,
          institution_id: resolvedInstitutionId,
          affiliate_university: normalizedAffiliateUniversity,
          programme_category: normalizedProgram,
          program_id: resolvedProgramRecord?.id || null,
          level: normalizedLevel,
          semester: normalizedSemester,
          index_number: validatedStudentIdentifier,
          metadata: {
            academic_program: trimmedAcademicProgram,
            college_name: resolvedInstitutionName,
            student_identifier_type: studentIdentifierType
          }
        }
        : {
          full_name: trimmedFullName || null
        });
      if (effectiveRole === 'student') {
        await recordRegistrationSecurityEvent(registrationSession, 'academic_saved', req, {
          institution_id: resolvedInstitutionId,
          affiliate_university: normalizedAffiliateUniversity,
          programme_category: normalizedProgram,
          program_id: resolvedProgramRecord?.id || null,
          level: normalizedLevel,
          semester: normalizedSemester,
          student_identifier_type: studentIdentifierType
        });
      }
      const billingIntent = await resolveBillingIntent(user);

      return res.json(buildMeResponse(user, onboarding, subscription, selectedPlan, billingIntent));
    } catch (error) {
      console.error('PATCH /me/profile error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
  },

  async updateAcademic(req, res) {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      const { level, semester } = req.body || {};
      if (level === undefined && semester === undefined) {
        return res.status(400).json({ success: false, error: 'Provide at least level or semester to update.' });
      }

      const updates = {};

      if (level !== undefined) {
        const normalizedLevel = normalizeLevel(level);
        if (!normalizedLevel) {
          return res.status(400).json({ success: false, error: 'Invalid level. Use 100, 200, 300, 400, or graduate.' });
        }
        updates.level = normalizedLevel;
      }

      if (semester !== undefined) {
        const normalizedSemester = normalizeSemester(String(semester));
        if (!normalizedSemester) {
          return res.status(400).json({ success: false, error: 'Invalid semester. Use 1 or 2.' });
        }
        updates.semester = normalizedSemester;
      }

      const levelChanged = updates.level && String(user.level || '') !== String(updates.level);
      const semesterChanged = updates.semester && String(user.semester || '') !== String(updates.semester);
      if (levelChanged || semesterChanged) {
        updates.academic_last_progressed_at = new Date();
      }

      await user.update(updates);

      // Sync AcademicProfile table (update only the changed fields)
      const academicUpdates = {};
      if (updates.level) academicUpdates.level = updates.level;
      if (updates.semester) academicUpdates.semester = updates.semester;
      if (Object.keys(academicUpdates).length) {
        await AcademicProfile.update(academicUpdates, { where: { user_id: user.id } });
      }

      return res.json({ success: true, level: user.level, semester: user.semester });
    } catch (error) {
      console.error('PATCH /me/academic error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update academic standing.' });
    }
  },

  async markAcademicStateNoticeSeen(req, res) {
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
          academic_state_notice_seen_key: noticeKey,
          academic_state_notice_seen_at: new Date().toISOString()
        }
      });

      return res.json({ success: true });
    } catch (error) {
      console.error('POST /me/academic-state-notice/seen error:', error);
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
      return res.json(buildMeResponse(user, onboarding, subscription, selectedPlan, billingIntent));
    } catch (error) {
      console.error('PATCH /me/password error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update password' });
    }
  }
};
