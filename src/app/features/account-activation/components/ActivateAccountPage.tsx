import { useEffect, useRef, useState } from 'react';
import { Button, TextField } from '@vibe/core';
import { Alert } from '@vibe/icons';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { EFlowMark } from '../../../../components/EFlowMark';
import { OnboardingShowcase, initialsOf } from '../../../components/ui/OnboardingShowcase';
import { PasswordGuidance } from '../../../components/ui/PasswordGuidance';
import { SkillTagSelector, skillListToMap, skillMapToList } from '../../../components/ui/SkillTagSelector';
import { motionTransition } from '../../../shared/motion';
import { readableUiError } from '../../../shared/userFacingError';
import { EflowVibeThemeProvider } from '../../../shared/vibe';
import { activationRoleLabel } from '../selectors';
import { completeAccountActivation, validateAccountActivation } from '../services/activationService';
import type { ActivationPreview, ActivationResult } from '../types';
import {
  ACTIVATION_NAME_MAX_LENGTH,
  ACTIVATION_PASSWORD_MAX_LENGTH,
  generateStrongPassword,
  isStrongActivationPassword,
  validateActivationConfirmation,
  validateActivationFields,
  validateActivationFullName,
  validateActivationPassword,
} from '../validation';
import '../activation.css';

type ActivationStep = 'profile' | 'password' | 'skills';

interface TouchedFields {
  fullName: boolean;
  password: boolean;
  confirmation: boolean;
}

const STEP_LABELS: Record<ActivationStep, string> = {
  profile: 'Profile',
  password: 'Password',
  skills: 'Skills',
};

/** Public step-by-step account-activation onboarding page inspired by monday.com's onboarding flow. */
export function ActivateAccountPage() {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [attempt] = useState(() => crypto.randomUUID());
  const [preview, setPreview] = useState<ActivationPreview>();
  const [result, setResult] = useState<ActivationResult>();
  const [step, setStep] = useState<ActivationStep>('profile');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [fullName, setFullName] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [touched, setTouched] = useState<TouchedFields>({
    fullName: false,
    password: false,
    confirmation: false,
  });
  const [attemptedSteps, setAttemptedSteps] = useState<Record<ActivationStep, boolean>>({
    profile: false,
    password: false,
    skills: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [suggestedPasswordActive, setSuggestedPasswordActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const copyTimer = useRef<number | undefined>(undefined);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    const previousTheme = root.dataset.theme;
    root.classList.remove('dark');
    root.dataset.theme = 'light';

    return () => {
      if (hadDark) root.classList.add('dark');
      if (previousTheme !== undefined) root.dataset.theme = previousTheme;
      else delete root.dataset.theme;
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    window.history.replaceState({}, '', '/activate-account');
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.append(meta);
    let current = true;

    if (!token) {
      setError('Open the activation link from your email.');
      setLoading(false);
    } else {
      void validateAccountActivation(token)
        .then(data => {
          if (!current) return;
          setPreview(data);
          setFullName(data.full_name || '');
          setSelectedSkills(skillMapToList(data.skills));
        })
        .catch(reason => {
          if (current) setError(reason.message);
        })
        .finally(() => {
          if (current) setLoading(false);
        });
    }

    return () => {
      current = false;
      meta.remove();
    };
  }, [token]);

  const hasSkillsStep =
    Boolean(preview) &&
    ((preview?.available_skills?.length || 0) > 0 || selectedSkills.length > 0);
  const steps: ActivationStep[] = hasSkillsStep
    ? ['profile', 'password', 'skills']
    : ['profile', 'password'];
  const currentStepIndex = Math.max(0, steps.indexOf(step));
  const currentStep = steps[currentStepIndex];
  const isFinalStep = currentStepIndex === steps.length - 1;
  const progressPercent = result
    ? 100
    : Math.round(((currentStepIndex + 1) / steps.length) * 100);

  const fullNameError = validateActivationFullName(fullName);
  const passwordError = validateActivationPassword(password);
  const confirmationError = validateActivationConfirmation(password, confirmation);

  const showFullNameError = Boolean(
    (touched.fullName || attemptedSteps.profile) && fullNameError,
  );
  const showPasswordError = Boolean(
    (touched.password || attemptedSteps.password) && passwordError,
  );
  const showConfirmationError = Boolean(
    (touched.confirmation || attemptedSteps.password) && confirmationError,
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (typeof event.getModifierState === 'function') {
      setCapsLockActive(event.getModifierState('CapsLock'));
    }
  };

  const handleSuggestPassword = () => {
    const generated = generateStrongPassword();
    setPassword(generated);
    setConfirmation(generated);
    setShowPassword(true);
    setSuggestedPasswordActive(true);
    setCopied(false);
    setError('');
    setTouched(prev => ({ ...prev, password: true, confirmation: true }));
  };

  const handleCopyPassword = async () => {
    if (!password || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const validateProfileStep = (): boolean => {
    setAttemptedSteps(prev => ({ ...prev, profile: true }));
    setTouched(prev => ({ ...prev, fullName: true }));
    const err = validateActivationFullName(fullName);
    if (err) {
      setError(err);
      document.getElementById('activation-full-name')?.focus();
      return false;
    }
    setError('');
    return true;
  };

  const validatePasswordStep = (): boolean => {
    setAttemptedSteps(prev => ({ ...prev, password: true }));
    setTouched(prev => ({ ...prev, password: true, confirmation: true }));
    const pErr = validateActivationPassword(password);
    const cErr = validateActivationConfirmation(password, confirmation);
    const firstErr = pErr || cErr;
    if (firstErr) {
      setError(firstErr);
      document
        .getElementById(pErr ? 'activation-new-password' : 'activation-confirm-password')
        ?.focus();
      return false;
    }
    setError('');
    return true;
  };

  const goToStep = (target: ActivationStep) => {
    const targetIndex = steps.indexOf(target);
    if (targetIndex < 0 || targetIndex === currentStepIndex || busy) return;
    if (targetIndex < currentStepIndex) {
      setDirection(-1);
      setError('');
      setStep(target);
      return;
    }
    if (currentStep === 'profile' && !validateProfileStep()) return;
    if (target === 'skills' && !validatePasswordStep()) return;
    setDirection(1);
    setError('');
    setStep(target);
  };

  const handleBack = () => {
    if (currentStepIndex <= 0 || busy) return;
    setDirection(-1);
    setError('');
    setStep(steps[currentStepIndex - 1]);
  };

  const handleStepSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !preview) return;

    if (!isFinalStep) {
      if (currentStep === 'profile' && !validateProfileStep()) return;
      if (currentStep === 'password' && !validatePasswordStep()) return;
      setDirection(1);
      setError('');
      setStep(steps[currentStepIndex + 1]);
      return;
    }

    setAttemptedSteps({ profile: true, password: true, skills: true });
    setTouched({ fullName: true, password: true, confirmation: true });

    const validationErrors = validateActivationFields({ fullName, password, confirmation });
    const firstError =
      validationErrors.fullName ||
      validationErrors.password ||
      validationErrors.confirmation;

    if (firstError) {
      setError(firstError);
      if (validationErrors.fullName) {
        setDirection(-1);
        setStep('profile');
      } else if (validationErrors.password || validationErrors.confirmation) {
        setDirection(-1);
        setStep('password');
      }
      return;
    }

    const cleanedName = fullName.trim();
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const skillsPayload = hasSkillsStep ? skillListToMap(selectedSkills) : undefined;
      setResult(await completeAccountActivation(token, password, attempt, skillsPayload, cleanedName));
      setPassword('');
      setConfirmation('');
      setSuggestedPasswordActive(false);
      setCopied(false);
    } catch (reason) {
      setError(readableUiError(reason, 'Could not activate your account. Please try again.', 'write'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const markState = busy
    ? 'submitting'
    : result
      ? 'success'
      : error
        ? 'error'
        : 'idle';

  const roleLabel = preview
    ? activationRoleLabel(preview.requested_privileged_role || preview.account_role)
    : 'Member';

  const stepVariants = reduceMotion
    ? undefined
    : {
        initial: { opacity: 0, x: direction * 18 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: direction * -18 },
      };

  const passwordReady = isStrongActivationPassword(password);
  const userInitials = initialsOf(fullName, 'YO');
  const displayName = fullName.trim() || 'Your profile';
  const officeTitle = preview?.office_name || 'eFlow Workspace';

  return (
    <EflowVibeThemeProvider preference="light">
      <main className="eflow-split-onboarding eflow-activation-page">
        <div className="eflow-split-main">
          {preview && (
            <div className="eflow-split-progress-track" aria-hidden="true">
              <div
                className="eflow-split-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          <section className="eflow-split-card eflow-activation-card" aria-busy={loading || busy}>
            <div className="eflow-split-topbar">
              <EFlowMark height={32} state={markState} />
              {preview && !result && (
                <div className="eflow-activation-step-dots" aria-label="Onboarding steps">
                  {steps.map((stepKey, idx) => {
                    const state =
                      idx < currentStepIndex
                        ? 'done'
                        : idx === currentStepIndex
                          ? 'current'
                          : 'upcoming';
                    const clickable =
                      !busy &&
                      (idx <= currentStepIndex ||
                        (stepKey === 'password' && !fullNameError) ||
                        (stepKey === 'skills' &&
                          !fullNameError &&
                          !passwordError &&
                          !confirmationError));
                    return (
                      <button
                        key={stepKey}
                        type="button"
                        className="eflow-activation-step-dot"
                        data-state={state}
                        aria-label={`Step ${idx + 1}: ${STEP_LABELS[stepKey]}`}
                        aria-current={state === 'current' ? 'step' : undefined}
                        disabled={!clickable}
                        onClick={() => goToStep(stepKey)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {loading ? (
              <>
                <h1>Welcome to eFlow</h1>
                <p className="eflow-activation-subtitle" role="status">
                  Checking your invitation…
                </p>
              </>
            ) : result ? (
              <>
                <h1>
                  {result.next_step === 'awaiting_authority'
                    ? 'Your email is verified'
                    : 'You’re ready to go'}
                </h1>
                <p className="eflow-activation-subtitle" role="status">
                  {result.next_step === 'awaiting_authority'
                    ? 'Your Admin needs to approve your role before you can sign in.'
                    : 'Your account is activated. Sign in with your email and new password.'}
                </p>
                <div className="eflow-activation-state-actions">
                  <Button onClick={() => window.location.assign('/')} kind="primary">
                    Go to sign in
                  </Button>
                </div>
              </>
            ) : preview ? (
              <form onSubmit={handleStepSubmit} noValidate>
                <AnimatePresence mode="wait" initial={false}>
                  {currentStep === 'profile' && (
                    <motion.div
                      key="step-profile"
                      className="eflow-activation-step-panel"
                      variants={stepVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={motionTransition.navigation}
                    >
                      <div className="eflow-activation-step-header">
                        <h1>Join {preview.office_name}</h1>
                        <p className="eflow-activation-subtitle">Complete your details to get started</p>
                      </div>

                      <div className="eflow-split-meta-strip">
                        <span className="eflow-split-meta-pill">
                          <strong>{preview.email}</strong>
                        </span>
                        <span className="eflow-split-meta-pill">
                          {roleLabel}
                        </span>
                      </div>

                      {preview.requested_privileged_role && (
                        <p className="eflow-activation-note">
                          This role needs Admin approval after you verify your email.
                        </p>
                      )}

                      <TextField
                        id="activation-full-name"
                        name="fullName"
                        title="Full name"
                        inputAriaLabel="Full name"
                        maxLength={ACTIVATION_NAME_MAX_LENGTH}
                        autoComplete="name"
                        placeholder="Enter your full name"
                        value={fullName}
                        disabled={busy}
                        onBlur={() => setTouched(prev => ({ ...prev, fullName: true }))}
                        onChange={value => {
                          setFullName(value);
                          setError('');
                        }}
                        validation={
                          showFullNameError
                            ? { status: 'error', text: fullNameError }
                            : undefined
                        }
                        required
                      />

                      {error && (
                        <p role="alert" className="eflow-activation-error">
                          {error}
                        </p>
                      )}

                      <div className="eflow-activation-actions eflow-activation-actions--end">
                        <Button
                          type="submit"
                          kind="primary"
                          className="eflow-activation-next"
                          disabled={busy}
                        >
                          <span>Continue</span>
                          <ChevronRight size={16} aria-hidden="true" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {currentStep === 'password' && (
                    <motion.div
                      key="step-password"
                      className="eflow-activation-step-panel"
                      variants={stepVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={motionTransition.navigation}
                    >
                      <div className="eflow-activation-step-header">
                        <h1>Set your password</h1>
                        <p className="eflow-activation-subtitle">
                          Choose a strong password for {preview.email}
                        </p>
                      </div>

                      <div className="eflow-activation-password-field">
                        <div className="eflow-activation-password-wrap">
                          <TextField
                            id="activation-new-password"
                            name="newPassword"
                            title="New password"
                            inputAriaLabel="New password"
                            type={showPassword ? 'text' : 'password'}
                            maxLength={ACTIVATION_PASSWORD_MAX_LENGTH}
                            autoComplete="new-password"
                            placeholder="Enter at least 12 characters"
                            value={password}
                            disabled={busy}
                            onKeyDown={handleKeyDown}
                            onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
                            onChange={value => {
                              setPassword(value);
                              setSuggestedPasswordActive(false);
                              setCopied(false);
                              setError('');
                            }}
                            validation={
                              showPasswordError
                                ? { status: 'error', text: passwordError }
                                : undefined
                            }
                            required
                          />
                          <button
                            type="button"
                            className="eflow-activation-eye"
                            aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                            aria-pressed={showPassword}
                            disabled={busy}
                            onClick={() => setShowPassword(prev => !prev)}
                          >
                            {showPassword ? (
                              <EyeOff size={17} aria-hidden="true" />
                            ) : (
                              <Eye size={17} aria-hidden="true" />
                            )}
                          </button>
                        </div>

                        <PasswordGuidance
                          password={password}
                          showInvalidState={touched.password || attemptedSteps.password}
                          disabled={busy}
                          suggestedActive={suggestedPasswordActive}
                          copied={copied}
                          onSuggest={handleSuggestPassword}
                          onCopy={() => void handleCopyPassword()}
                        />
                      </div>

                      <div className="eflow-activation-password-wrap">
                        <TextField
                          id="activation-confirm-password"
                          name="confirmPassword"
                          title="Confirm password"
                          inputAriaLabel="Confirm password"
                          type={showConfirm ? 'text' : 'password'}
                          maxLength={ACTIVATION_PASSWORD_MAX_LENGTH}
                          autoComplete="new-password"
                          placeholder="Re-enter your password"
                          value={confirmation}
                          disabled={busy}
                          onKeyDown={handleKeyDown}
                          onBlur={() => setTouched(prev => ({ ...prev, confirmation: true }))}
                          onChange={value => {
                            setConfirmation(value);
                            setError('');
                          }}
                          validation={
                            showConfirmationError
                              ? { status: 'error', text: confirmationError }
                              : (touched.confirmation || attemptedSteps.password) &&
                                  confirmation &&
                                  !confirmationError &&
                                  !passwordError
                                ? { status: 'success', text: 'Passwords match.' }
                                : undefined
                          }
                          required
                        />
                        <button
                          type="button"
                          className="eflow-activation-eye"
                          aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                          aria-pressed={showConfirm}
                          disabled={busy}
                          onClick={() => setShowConfirm(prev => !prev)}
                        >
                          {showConfirm ? (
                            <EyeOff size={17} aria-hidden="true" />
                          ) : (
                            <Eye size={17} aria-hidden="true" />
                          )}
                        </button>
                      </div>

                      {capsLockActive && (
                        <div className="eflow-activation-caps" role="status">
                          <Alert size={14} />
                          <span>Caps Lock is on</span>
                        </div>
                      )}

                      {error && (
                        <p role="alert" className="eflow-activation-error">
                          {error}
                        </p>
                      )}

                      <div className="eflow-activation-actions">
                        <button
                          type="button"
                          className="eflow-activation-back-btn"
                          disabled={busy}
                          onClick={handleBack}
                        >
                          <ChevronLeft size={15} aria-hidden="true" />
                          <span>Back</span>
                        </button>
                        {isFinalStep ? (
                          <Button
                            type="submit"
                            kind="primary"
                            className="eflow-activation-next"
                            loading={busy}
                            disabled={busy}
                          >
                            Activate account
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            kind="primary"
                            className="eflow-activation-next"
                            disabled={busy}
                          >
                            <span>Continue</span>
                            <ChevronRight size={16} aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {currentStep === 'skills' && (
                    <motion.div
                      key="step-skills"
                      className="eflow-activation-step-panel"
                      variants={stepVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={motionTransition.navigation}
                    >
                      <div className="eflow-activation-step-header">
                        <h1>What are your main skills?</h1>
                        <p className="eflow-activation-subtitle">
                          Help your team tailor tasks and collaboration in {preview.office_name}.
                        </p>
                      </div>

                      <SkillTagSelector
                        variant="checklist"
                        availableTags={preview.available_skills ?? []}
                        selected={selectedSkills}
                        disabled={busy}
                        title="Select your skills"
                        description="Optional — you can update these anytime."
                        onChange={setSelectedSkills}
                      />

                      {error && (
                        <p role="alert" className="eflow-activation-error">
                          {error}
                        </p>
                      )}

                      <div className="eflow-activation-actions">
                        <button
                          type="button"
                          className="eflow-activation-back-btn"
                          disabled={busy}
                          onClick={handleBack}
                        >
                          <ChevronLeft size={15} aria-hidden="true" />
                          <span>Back</span>
                        </button>
                        <Button
                          type="submit"
                          kind="primary"
                          className="eflow-activation-next"
                          loading={busy}
                          disabled={busy}
                        >
                          Activate account
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            ) : (
              <>
                <h1>Welcome to eFlow</h1>
                <p role="alert" className="eflow-activation-error">
                  {error || 'This activation link is no longer valid.'}
                </p>
                <p className="eflow-activation-subtitle">
                  Ask your Admin to send a new invitation.
                </p>
                <div className="eflow-activation-state-actions">
                  <Button kind="secondary" onClick={() => window.location.assign('/')}>
                    Back to sign in
                  </Button>
                </div>
              </>
            )}

            <p className="eflow-split-footnote">
              Your office and role were selected by your Admin. Your password stays private.
            </p>
          </section>
        </div>

        <OnboardingShowcase
          scene={result || currentStep === 'skills' ? 'cascade' : 'board'}
          title={officeTitle}
          badgeText={roleLabel}
          userInitials={userInitials}
          rows={[
            {
              label: displayName,
              badge: fullName.trim().length >= 2 ? 'Ready' : 'Setup',
              tone: fullName.trim().length >= 2 ? 'ready' : 'working',
            },
            {
              label: currentStep === 'password' ? 'Account security' : 'Workspace access',
              badge: passwordReady ? 'Secured' : currentStep === 'password' ? 'Setting' : 'Pending',
              tone: passwordReady ? 'ready' : currentStep === 'password' ? 'working' : 'muted',
              icon: 'lock',
            },
          ]}
          doneLabel={passwordReady ? 'Secured' : 'Done'}
          cascadeLabel={
            result
              ? `${displayName} joined ${officeTitle}`
              : selectedSkills.length > 0
                ? selectedSkills.slice(0, 2).join(' · ')
                : `Collaborating with ${officeTitle}`
          }
          cascadeStatus={
            result
              ? 'Activated'
              : selectedSkills.length > 0
                ? `${selectedSkills.length} selected`
                : 'Ready'
          }
        />
      </main>
    </EflowVibeThemeProvider>
  );
}
