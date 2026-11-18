import { useEffect, useRef, useState } from 'react';
import { Button, TextField } from '@vibe/core';
import { Alert } from '@vibe/icons';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { EFlowMark } from '../../../../components/EFlowMark';
import { OnboardingShowcase, initialsOf } from '../../../components/ui/OnboardingShowcase';
import { PasswordGuidance } from '../../../components/ui/PasswordGuidance';
import {
  generateStrongPassword,
  isStrongPassword,
  validateNewPassword,
  validatePasswordConfirmation,
} from '../../../shared/passwordPolicy';
import { isAdminRole } from '../../../shared/roles';
import { EflowVibeThemeProvider } from '../../../shared/vibe';
import {
  RESET_PASSWORD_MAX_LENGTH,
  completePasswordRecovery,
  extractRecoveryTokenHash,
  hasRecoveryParamsInUrl,
  parseRecoveryErrorFromUrl,
  verifyRecoveryTokenHash,
} from '../services/passwordRecovery';
import '../passwordRecovery.css';

type RecoveryStatus = 'checking' | 'ready' | 'success' | 'invalid';

export function ResetPasswordPage({
  accountEmail,
  accountRole,
  hasActiveRecovery = false,
  onRecoveryComplete,
}: {
  accountEmail?: string | null;
  accountRole?: string | null;
  hasActiveRecovery?: boolean;
  onRecoveryComplete?: () => void;
}) {
  const [status, setStatus] = useState<RecoveryStatus>(() =>
    hasActiveRecovery ? 'ready' : 'checking',
  );
  const [email, setEmail] = useState(accountEmail || '');
  const [signInPath, setSignInPath] = useState(() =>
    isAdminRole(accountRole) ? '/admin' : '/',
  );
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [touched, setTouched] = useState({ password: false, confirmation: false });
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [suggestedPasswordActive, setSuggestedPasswordActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const copyTimer = useRef<number | undefined>(undefined);
  const hasActiveRecoveryRef = useRef(hasActiveRecovery);
  hasActiveRecoveryRef.current = hasActiveRecovery;

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (accountEmail) setEmail(accountEmail);
  }, [accountEmail]);

  useEffect(() => {
    if (accountRole) {
      setSignInPath(isAdminRole(accountRole) ? '/admin' : '/');
    }
  }, [accountRole]);

  useEffect(() => {
    if (hasActiveRecovery) {
      setStatus((current) => (current === 'checking' || current === 'invalid' ? 'ready' : current));
    }
  }, [hasActiveRecovery]);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.append(meta);

    let mounted = true;
    const search = window.location.search;
    const hash = window.location.hash;
    const urlError = parseRecoveryErrorFromUrl(search, hash);
    const tokenHash = extractRecoveryTokenHash(search, hash);
    const expectsRecoveryFromUrl = hasRecoveryParamsInUrl(search, hash);

    const scrubUrl = () => {
      if (window.location.pathname !== '/reset-password' || window.location.search || window.location.hash) {
        window.history.replaceState({}, '', '/reset-password');
      }
    };

    if (urlError) {
      scrubUrl();
      setError(urlError);
      setStatus((current) => (current === 'success' ? current : 'invalid'));
      return () => {
        mounted = false;
        meta.remove();
      };
    }

    let fallbackTimer: number | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session?.user) {
        if (session.user.email) setEmail(session.user.email);
        scrubUrl();
        setStatus((current) => (current === 'success' ? current : 'ready'));
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
      }
    });

    if (tokenHash) {
      void verifyRecoveryTokenHash(tokenHash)
        .then(async () => {
          if (!mounted) return;
          const { data } = await supabase.auth.getSession();
          if (!mounted) return;
          if (data.session?.user?.email) setEmail(data.session.user.email);
          scrubUrl();
          setStatus((current) => (current === 'success' ? current : 'ready'));
        })
        .catch((reason) => {
          if (!mounted) return;
          scrubUrl();
          setStatus((current) => {
            if (current === 'success' || current === 'ready') return current;
            setError(
              reason instanceof Error && reason.message
                ? reason.message
                : 'This password reset link is invalid or has expired. Request a new one from the sign-in page.',
            );
            return 'invalid';
          });
        });

      return () => {
        mounted = false;
        subscription.unsubscribe();
        meta.remove();
      };
    }

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      if (sessionError) {
        scrubUrl();
        setStatus((current) => {
          if (current === 'success' || current === 'ready') return current;
          setError('This password reset link is invalid or has expired. Request a new one from the sign-in page.');
          return 'invalid';
        });
        return;
      }
      if (data.session?.user) {
        if (data.session.user.email) setEmail(data.session.user.email);
        scrubUrl();
        setStatus((current) => (current === 'success' ? current : 'ready'));
        return;
      }
      if (hasActiveRecoveryRef.current) {
        setStatus((current) => (current === 'success' ? current : 'ready'));
        return;
      }
      if (!expectsRecoveryFromUrl) {
        scrubUrl();
        setStatus((current) => {
          if (current === 'success' || current === 'ready') return current;
          setError('Open the password reset link from your email, or request a new one from the sign-in page.');
          return 'invalid';
        });
        return;
      }
      fallbackTimer = window.setTimeout(() => {
        if (!mounted) return;
        scrubUrl();
        setStatus((current) => {
          if (current !== 'checking') return current;
          setError('This password reset link is invalid or has expired. Request a new one from the sign-in page.');
          return 'invalid';
        });
      }, 2500);
    });

    return () => {
      mounted = false;
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
      meta.remove();
    };
  }, []);

  const passwordError = validateNewPassword(password);
  const confirmationError = validatePasswordConfirmation(password, confirmation);
  const showPasswordError = Boolean((touched.password || submitted) && passwordError);
  const showConfirmationError = Boolean((touched.confirmation || submitted) && confirmationError);
  const recoveryPasswordReady = isStrongPassword(password);
  const recoveryInitials = initialsOf(email.split('@')[0] || 'eFlow', 'EF');

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
    setTouched({ password: true, confirmation: true });
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || status !== 'ready') return;

    setSubmitted(true);
    setTouched({ password: true, confirmation: true });
    const validationError = passwordError || confirmationError;
    if (validationError) {
      setError(validationError);
      const targetId = passwordError ? 'reset-new-password' : 'reset-confirm-password';
      document.getElementById(targetId)?.focus();
      return;
    }

    const nextSignInPath = isAdminRole(accountRole) ? '/admin' : signInPath;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await completePasswordRecovery(password);
      setPassword('');
      setConfirmation('');
      setSuggestedPasswordActive(false);
      setCopied(false);
      setSignInPath(nextSignInPath);
      onRecoveryComplete?.();
      setStatus('success');
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message
          ? reason.message
          : 'Could not update your password. Request a new reset link and try again.',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const goToSignIn = () => {
    onRecoveryComplete?.();
    window.location.assign(signInPath);
  };

  const markState =
    busy
      ? 'submitting'
      : status === 'success'
        ? 'success'
        : status === 'invalid' || Boolean(error)
          ? 'error'
          : 'idle';

  return (
    <EflowVibeThemeProvider preference="light">
      <main className="eflow-split-onboarding eflow-recovery-page">
        <div className="eflow-split-main">
          {status === 'ready' && (
            <div className="eflow-split-progress-track" aria-hidden="true">
              <div
                className="eflow-split-progress-fill"
                style={{ width: recoveryPasswordReady && !confirmationError ? '100%' : '55%' }}
              />
            </div>
          )}

          <section className="eflow-split-card eflow-recovery-card" aria-busy={status === 'checking' || busy}>
            <div className="eflow-split-topbar">
              <EFlowMark height={32} state={markState} />
            </div>
            <p className="eflow-recovery-eyebrow">PASSWORD RECOVERY</p>
            <h1>
              {status === 'success'
                ? 'Password updated'
                : status === 'invalid'
                  ? 'Reset link unavailable'
                  : 'Set a new password'}
            </h1>

            {status === 'checking' ? (
              <p className="eflow-split-subtitle" role="status">
                Verifying your password reset link…
              </p>
            ) : status === 'success' ? (
              <>
                <div className="eflow-recovery-success-box" role="status">
                  <CheckCircle2 size={20} aria-hidden="true" />
                  <span>
                    Your password has been updated. Sign in with your email and new password.
                  </span>
                </div>
                <div className="eflow-recovery-actions">
                  <Button onClick={goToSignIn} kind="primary">
                    Go to sign in
                  </Button>
                </div>
              </>
            ) : status === 'ready' ? (
              <>
                <p className="eflow-split-subtitle">Choose a strong new password for your eFlow account.</p>
                {email && (
                  <div className="eflow-split-meta-strip" style={{ marginTop: 14 }}>
                    <span className="eflow-split-meta-pill">
                      <strong>{email}</strong>
                    </span>
                  </div>
                )}
                <form onSubmit={handleSubmit} noValidate>
                  <div className="eflow-recovery-password-field">
                    <div className="eflow-recovery-password-wrap">
                      <TextField
                        id="reset-new-password"
                        title="New password"
                        inputAriaLabel="New password"
                        type={showPassword ? 'text' : 'password'}
                        maxLength={RESET_PASSWORD_MAX_LENGTH}
                        autoComplete="new-password"
                        placeholder="Enter at least 12 characters"
                        value={password}
                        disabled={busy}
                        onKeyDown={handleKeyDown}
                        onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                        onChange={(value) => {
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
                        className="eflow-recovery-eye"
                        aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                        aria-pressed={showPassword}
                        disabled={busy}
                        onClick={() => setShowPassword((prev) => !prev)}
                      >
                        {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                      </button>
                    </div>

                    <PasswordGuidance
                      password={password}
                      showInvalidState={touched.password || submitted}
                      disabled={busy}
                      suggestedActive={suggestedPasswordActive}
                      copied={copied}
                      onSuggest={handleSuggestPassword}
                      onCopy={() => void handleCopyPassword()}
                    />
                  </div>

                  <div className="eflow-recovery-password-wrap">
                    <TextField
                      id="reset-confirm-password"
                      title="Confirm password"
                      inputAriaLabel="Confirm password"
                      type={showConfirm ? 'text' : 'password'}
                      maxLength={RESET_PASSWORD_MAX_LENGTH}
                      autoComplete="new-password"
                      placeholder="Re-enter your password"
                      value={confirmation}
                      disabled={busy}
                      onKeyDown={handleKeyDown}
                      onBlur={() => setTouched((prev) => ({ ...prev, confirmation: true }))}
                      onChange={(value) => {
                        setConfirmation(value);
                        setError('');
                      }}
                      validation={
                        showConfirmationError
                          ? { status: 'error', text: confirmationError }
                          : (touched.confirmation || submitted) &&
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
                      className="eflow-recovery-eye"
                      aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                      aria-pressed={showConfirm}
                      disabled={busy}
                      onClick={() => setShowConfirm((prev) => !prev)}
                    >
                      {showConfirm ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                    </button>
                  </div>

                  {capsLockActive && (
                    <div className="eflow-recovery-caps" role="status">
                      <Alert size={14} />
                      <span>Caps Lock is on</span>
                    </div>
                  )}

                  {error && (
                    <p role="alert" className="eflow-recovery-error">
                      {error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    kind="primary"
                    loading={busy}
                    disabled={busy}
                  >
                    Update password
                  </Button>
                </form>
              </>
            ) : (
              <>
                <p role="alert" className="eflow-recovery-error">
                  {error || 'This password reset link is no longer valid.'}
                </p>
                <div className="eflow-recovery-actions">
                  <Button kind="secondary" onClick={goToSignIn}>
                    Back to sign in
                  </Button>
                </div>
              </>
            )}

            <p className="eflow-split-footnote">
              Your password stays private. If your account was locked after repeated failed attempts, ask an Admin to unlock it before signing in.
            </p>
          </section>
        </div>

        <OnboardingShowcase
          scene={status === 'success' ? 'cascade' : 'board'}
          title="Account security"
          badgeText="Recovery"
          userInitials={recoveryInitials}
          rows={[
            {
              label: email ? 'Account email' : 'eFlow account',
              badge: status === 'invalid' ? 'Expired' : 'Verified',
              tone: status === 'invalid' ? 'muted' : 'ready',
            },
            {
              label: 'New password',
              badge: status === 'success' ? 'Updated' : recoveryPasswordReady ? 'Secured' : 'Setting',
              tone: status === 'success' || recoveryPasswordReady ? 'ready' : 'working',
              icon: 'lock',
            },
          ]}
          doneLabel={status === 'success' ? 'Updated' : recoveryPasswordReady ? 'Secured' : 'Reset'}
          cascadeLabel="Password updated"
          cascadeStatus="Secured"
        />
      </main>
    </EflowVibeThemeProvider>
  );
}
