import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { FiArrowLeft, FiEye, FiEyeOff } from 'react-icons/fi';
import { ONBOARDING_STEPS } from '../../../utils/onboarding';
import { formatIndexNumberInput } from '../../../utils/studentIdentity';
import ConfettiOverlay from '../../gamification/ConfettiOverlay';
import { toDisplayName, getPlanCopy } from '../../../utils/contributionPlans';
import { BILLING_DURATION_OPTIONS } from '../../../utils/billingUpgrade';

export default function OnboardingContent({
  completionSummary,
  currentStep,
  profileSubStep,
  processing,
  profileForm,
  needsPasswordInPersonal,
  universities,
  selectedCollege,
  colleges,
  collegeOptions,
  collegesLoading,
  programCategoryOptions,
  academicProgramOptions,
  indexExample,
  submitPersonalInfo,
  submitProfile,
  setProfileForm,
  submitPassword,
  goToPersonalInfo,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  setError,
  goToPreviousStep,
  plansLoading,
  plans,
  planDescriptionOverrides,
  selectedPlan,
  processingPlanId,
  durationMonths,
  setDurationMonths,
  paymentTotal,
  startCheckout,
  selectPlan,
  handleGoToHome,
  avatarPreview,
  onAvatarChange,
  avatarError,
}) {
  const avatarInputRef = useRef(null);
  const indexInputRef = useRef(null);
  const indexCursorRef = useRef(null);
  const [confettiActive, setConfettiActive] = useState(false);

  useEffect(() => {
    if (completionSummary) setConfettiActive(true);
  }, [completionSummary]);

  // Restore cursor after React re-renders the formatted index number value.
  useLayoutEffect(() => {
    if (indexCursorRef.current !== null && indexInputRef.current) {
      const pos = indexCursorRef.current;
      indexCursorRef.current = null;
      indexInputRef.current.setSelectionRange(pos, pos);
    }
  });

  const formatPlanAmount = (amount) => {
    const value = Number(amount || 0);
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
  };

  if (completionSummary) {
    const renewalLabel = completionSummary.renewalDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const autoRenewLabel = completionSummary.autoRenew === true
      ? 'Enabled'
      : completionSummary.autoRenew === false
        ? 'Disabled'
        : 'Check account settings';

    return (
      <div className="auth-onboarding-form auth-onboarding-success">
        <ConfettiOverlay
          active={confettiActive}
          mode="fireworks"
          onDone={() => setConfettiActive(false)}
        />
        <div className="summary-card auth-onboarding-success-card">
          <div className="auth-onboarding-success-hero">
            <span className="auth-onboarding-success-kicker">Congratulations</span>
            <h4>
              {completionSummary.paymentStatusLabel}: {completionSummary.planName}
            </h4>
            <p className="auth-onboarding-success-copy">
              Your payment was successful and your plan is now active.
            </p>
          </div>
          <p className="auth-onboarding-inline auth-onboarding-success-renewal">
            {completionSummary.renewalMessage}
          </p>
          <div className="auth-onboarding-success-meta">
            <div className="summary-item">
              <span>{completionSummary.renewalIsEstimated ? 'Estimated renewal' : 'Next renewal'}</span>
              <strong>{renewalLabel}</strong>
            </div>
            <div className="summary-item">
              <span>Automatic renewal</span>
              <strong>{autoRenewLabel}</strong>
            </div>
          </div>
          {completionSummary.planDescription ? (
            <div className="auth-onboarding-success-features">
              <strong>You can now enjoy:</strong>
              <p>{completionSummary.planDescription}</p>
            </div>
          ) : null}
        </div>

        <div className="auth-actions">
          <button className="auth-btn primary" type="button" onClick={handleGoToHome}>
            Enjoy Learnda
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === ONBOARDING_STEPS.PROFILE) {
    if (profileSubStep === 'personal') {
      return (
        <form onSubmit={submitPersonalInfo} className="auth-onboarding-form">
          <div className="onboarding-personal-panel">
            <div className="onboarding-avatar-hero">
              <div
                className="onboarding-avatar-picker"
                onClick={() => avatarInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Upload profile photo"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') avatarInputRef.current?.click(); }}
              >
                {avatarPreview
                  ? <img src={avatarPreview} alt="Your photo" className="onboarding-avatar-preview" />
                  : <span className="onboarding-avatar-placeholder">+</span>}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: 'none' }}
                onChange={onAvatarChange}
                disabled={processing}
              />
              <p className="onboarding-avatar-label">{avatarPreview ? 'Tap to change photo' : 'Add a profile photo'}</p>
              {avatarError && (
                <p className="onboarding-avatar-error">{avatarError}</p>
              )}
            </div>

            <div className="auth-onboarding-grid onboarding-personal-fields">
              <div className="auth-onboarding-span-two onboarding-section-label">
                <span>Personal info</span>
              </div>

              <div className="form-group auth-onboarding-span-two">
                <label htmlFor="onboarding-full-name">Full Name</label>
                <input
                  id="onboarding-full-name"
                  type="text"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  required
                  disabled={processing}
                />
              </div>

              <div className="form-group auth-onboarding-span-two">
                <label htmlFor="onboarding-index">Index / Application No.</label>
                <input
                  id="onboarding-index"
                  ref={indexInputRef}
                  value={profileForm.index_number}
                  onChange={(e) => {
                    const selStart = e.target.selectionStart;
                    // Count raw (alphanumeric) chars before the cursor so we can
                    // map it back to the right position in the formatted string.
                    const rawBefore = e.target.value.slice(0, selStart).replace(/[^A-Z0-9]/gi, '').length;
                    const formatted = formatIndexNumberInput(e.target.value);
                    let rawCount = 0;
                    let newCursor = formatted.length;
                    for (let i = 0; i <= formatted.length; i++) {
                      if (rawCount >= rawBefore) { newCursor = i; break; }
                      if (i < formatted.length && /[A-Z0-9]/i.test(formatted[i])) rawCount++;
                    }
                    indexCursorRef.current = newCursor;
                    setProfileForm((prev) => ({ ...prev, index_number: formatted }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Backspace') return;
                    const input = e.currentTarget;
                    const cursorAtEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
                    if (!cursorAtEnd || !profileForm.index_number.endsWith('/')) return;
                    e.preventDefault();
                    const nextRawValue = profileForm.index_number.slice(0, -2);
                    setProfileForm((prev) => ({
                      ...prev,
                      index_number: formatIndexNumberInput(nextRawValue),
                    }));
                  }}
                  style={{ textTransform: 'uppercase' }}
                  placeholder={`e.g. ${indexExample}`}
                  inputMode="text"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck="false"
                  maxLength={19}
                  required
                  disabled={processing}
                />
              </div>

              {needsPasswordInPersonal ? (
                <>
                  <div className="auth-onboarding-span-two onboarding-section-label">
                    <span>Account security</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="onboarding-password">Password</label>
                    <div className="password-field">
                      <input
                        id="onboarding-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError('');
                        }}
                        placeholder="At least 8 characters"
                        required
                        disabled={processing}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        disabled={processing}
                      >
                        {showPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="onboarding-password-confirm">Confirm Password</label>
                    <div className="password-field">
                      <input
                        id="onboarding-password-confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setError('');
                        }}
                        placeholder="Re-enter your password"
                        required
                        disabled={processing}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        disabled={processing}
                      >
                        {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="auth-actions">
            <button className="auth-btn primary" type="submit" disabled={processing}>
              Continue
            </button>
          </div>
        </form>
      );
    }

    return (
      <form onSubmit={submitProfile} className="auth-onboarding-form">
        <div className="auth-onboarding-grid">
          <div className="auth-onboarding-span-two onboarding-section-label">
            <span>Institution</span>
          </div>

          <div className="form-group">
            <label htmlFor="onboarding-affiliate-university">Affiliated University</label>
            <select
              id="onboarding-affiliate-university"
              value={profileForm.affiliate_university}
              onChange={(e) => {
                const nextUniversity = e.target.value;
                setProfileForm((prev) => {
                  const preserveCollege = selectedCollege?.affiliate_university === nextUniversity;
                  return {
                    ...prev,
                    affiliate_university: nextUniversity,
                    institution_id: preserveCollege ? prev.institution_id : '',
                    institution: preserveCollege ? prev.institution : '',
                    program: preserveCollege ? prev.program : '',
                    academic_program: preserveCollege ? prev.academic_program : '',
                  };
                });
              }}
              required
              disabled={processing}
            >
              <option value="">Select university</option>
              {universities.map((option) => (
                <option key={option.value || option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="onboarding-college">College</label>
            <select
              id="onboarding-college"
              value={profileForm.institution_id}
              onChange={(e) => {
                const selectedId = e.target.value;
                const nextCollege = colleges.find((item) => String(item.id) === String(selectedId));
                setProfileForm((prev) => ({
                  ...prev,
                  institution_id: selectedId,
                  institution: nextCollege?.name || '',
                  affiliate_university: String(nextCollege?.affiliate_university || '').trim(),
                  program: '',
                  academic_program: '',
                }));
              }}
              required
              disabled={processing}
            >
              <option value="">
                {collegesLoading ? 'Loading...' : 'Select college'}
              </option>
              {collegeOptions.map((college) => (
                <option key={college.id} value={college.id}>
                  {college.name}
                </option>
              ))}
            </select>
          </div>

          {selectedCollege?.notes?.length ? (
            <div className="auth-onboarding-span-two">
              <p className="auth-onboarding-hint">{selectedCollege.notes.join(' · ')}</p>
            </div>
          ) : null}

          <div className="auth-onboarding-span-two onboarding-section-label">
            <span>Programme</span>
          </div>

          <div className="form-group">
            <label htmlFor="onboarding-program">Category</label>
            <select
              id="onboarding-program"
              value={profileForm.program}
              onChange={(e) => setProfileForm((prev) => ({
                ...prev,
                program: e.target.value,
                academic_program: '',
              }))}
              required
              disabled={processing || !selectedCollege}
            >
              <option value="">Select category</option>
              {programCategoryOptions.map((category) => (
                <option key={category.code || category.name} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="onboarding-academic-program">Programme</label>
            <select
              id="onboarding-academic-program"
              value={profileForm.academic_program}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, academic_program: e.target.value }))}
              required
              disabled={processing || !profileForm.program}
            >
              <option value="">Select programme</option>
              {academicProgramOptions.map((programOption) => (
                <option
                  key={programOption.id || programOption.key || programOption.name}
                  value={programOption.name}
                >
                  {programOption.name}
                  {programOption.is_placeholder ? ' (general track)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="auth-onboarding-span-two onboarding-section-label">
            <span>Standing</span>
          </div>

          <div className="form-group">
            <label htmlFor="onboarding-level">Level</label>
            <select
              id="onboarding-level"
              value={profileForm.level}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, level: e.target.value }))}
              required
              disabled={processing}
            >
              <option value="">Select level</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="300">300</option>
              <option value="400">400</option>
              <option value="graduate">Graduate</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="onboarding-semester">Semester</label>
            <select
              id="onboarding-semester"
              value={profileForm.semester}
              onChange={(e) => setProfileForm((prev) => ({ ...prev, semester: e.target.value }))}
              required
              disabled={processing}
            >
              <option value="">Select semester</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>

        </div>

        <div className="auth-actions">
          <button
            className="auth-btn secondary auth-back-btn"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goToPersonalInfo();
            }}
            disabled={processing}
          >
            <FiArrowLeft aria-hidden />
          </button>
          <button className="auth-btn primary" type="submit" disabled={processing}>
            {processing ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </form>
    );
  }

  if (currentStep === ONBOARDING_STEPS.PASSWORD) {
    return (
      <form onSubmit={submitPassword} className="auth-onboarding-form">
        <div className="onboarding-password-fields">
          <div className="form-group">
            <label htmlFor="onboarding-password">Password</label>
            <div className="password-field">
              <input
                id="onboarding-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="At least 8 characters"
                required
                disabled={processing}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={processing}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="onboarding-password-confirm">Confirm Password</label>
            <div className="password-field">
              <input
                id="onboarding-password-confirm"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                placeholder="Re-enter your password"
                required
                disabled={processing}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                disabled={processing}
              >
                {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>
        </div>
        <div className="auth-actions">
          <button
            className="auth-btn secondary auth-back-btn"
            type="button"
            onClick={goToPreviousStep}
            disabled={processing}
          >
            <FiArrowLeft aria-hidden />
          </button>
          <button className="auth-btn primary" type="submit" disabled={processing}>
            {processing ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </form>
    );
  }

  if (currentStep === ONBOARDING_STEPS.PLAN) {
    return (
      <div className="auth-onboarding-form">
        {plansLoading ? (
          <p className="auth-onboarding-inline">Loading plans...</p>
        ) : (
          <div className="auth-onboarding-plan-list">
            {plans.map((plan) => {
              const isPaidPlan = Number(plan.price || 0) > 0;
              const isSelectedPlan = selectedPlan?.id === plan.id;
              const isSelectingThisPlan = processing && processingPlanId === plan.id;

              return (
                <div
                  className={`auth-onboarding-plan-item ${isSelectedPlan ? 'is-selected' : ''}`.trim()}
                  key={plan.id}
                >
                  <div className="auth-onboarding-plan-header">
                    <div>
                      <h4>{toDisplayName(plan.name)}</h4>
                      <p>{planDescriptionOverrides?.[plan.name] || getPlanCopy(plan.name).description}</p>
                    </div>
                    <div className="auth-onboarding-plan-price">
                      <strong>{isPaidPlan ? `GHS ${formatPlanAmount(plan.price)}` : 'Free'}</strong>
                      {isPaidPlan ? <span>/ month</span> : null}
                    </div>
                  </div>
                  <button
                    className={`auth-btn ${isPaidPlan ? 'primary' : 'secondary'} auth-onboarding-plan-btn`}
                    type="button"
                    onClick={() => selectPlan(plan)}
                    disabled={processing || (isPaidPlan && isSelectedPlan)}
                  >
                    {isSelectingThisPlan
                      ? 'Setting up...'
                      : isPaidPlan && isSelectedPlan
                        ? 'Selected'
                        : isPaidPlan
                          ? getPlanCopy(plan.name).ctaLabel
                          : getPlanCopy(plan.name).ctaLabel}
                  </button>

                  {isPaidPlan && isSelectedPlan ? (
                    <div className="auth-onboarding-payment-section">
                      <div className="auth-onboarding-grid">
                        <div className="form-group">
                          <label htmlFor="payment-duration">Billing period</label>
                          <select
                            id="payment-duration"
                            value={durationMonths}
                            onChange={(e) => setDurationMonths(Number(e.target.value) || 1)}
                            disabled={processing}
                          >
                            {BILLING_DURATION_OPTIONS.map((months) => (
                              <option key={months} value={months}>
                                {months} {months === 1 ? 'month' : 'months'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Total</label>
                          <input value={`GHS ${formatPlanAmount(paymentTotal)}`} disabled readOnly />
                        </div>
                      </div>
                      <p className="auth-onboarding-hint">
                        Final amount including charges is shown at checkout.
                      </p>
                      <button
                        className="auth-btn primary"
                        type="button"
                        onClick={startCheckout}
                        disabled={processing}
                      >
                        {processing ? 'Processing...' : 'Continue to Payment'}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        <div className="auth-actions auth-onboarding-plan-back">
          <button
            className="auth-btn secondary auth-back-btn"
            type="button"
            onClick={goToPreviousStep}
            disabled={processing}
          >
            <FiArrowLeft aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
