import { useState, useEffect, useCallback, useRef } from "react";
import { validateLoginFields, signInWithAccountProtection } from "../../app/features/authentication";
import { useAuth } from "../../app/contexts/AuthContext";
import { SESSION_NOTICE_KEY } from "../../app/features/session-security/constants";
import { clearAllSessionActivity } from "../../app/features/session-security/services/sessionActivityStorage";

export type LoginFormState =
  | "idle"
  | "validating"
  | "submitting"
  | "invalid_credentials"
  | "account_locked"
  | "network_offline"
  | "server_error"
  | "success";

interface FieldErrors {
  email?: string;
  password?: string;
}

export interface UseLoginFormReturn {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  rememberMe: boolean;
  setRememberMe: (val: boolean) => void;
  state: LoginFormState;
  errorMessage: string | null;
  fieldErrors: FieldErrors;
  capsLockActive: boolean;
  cooldownSeconds: number;
  shakeField: "email" | "password" | null;
  isSubmitDisabled: boolean;
  handleEmailBlur: () => void;
  handlePasswordBlur: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  loginWithCredentials: (email: string, pass: string) => Promise<void>;
  resetForm: () => void;
}

export function useLoginForm(): UseLoginFormReturn {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const [state, setState] = useState<LoginFormState>(() => {
    return typeof navigator !== "undefined" && !navigator.onLine ? "network_offline" : "idle";
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [capsLockActive, setCapsLockActive] = useState(false);
  const cooldownSeconds = 0; // Compatibility only: account locks never expire on the client.
  const [shakeField, setShakeField] = useState<"email" | "password" | null>(null);

  const submittingRef = useRef(false);

  // Safely attempt useAuth if mounted within AuthProvider
  let authContext: ReturnType<typeof useAuth> | null = null;
  try {
    authContext = useAuth();
  } catch {
    authContext = null;
  }

  // Monitor online / offline status
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => (prev === "network_offline" ? "idle" : prev));
      setErrorMessage(null);
    };

    const handleOffline = () => {
      setState("network_offline");
      setErrorMessage("No internet connection detected. Please check your network.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Caps Lock listener via keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (typeof e.getModifierState === "function") {
      const isCaps = e.getModifierState("CapsLock");
      setCapsLockActive(isCaps);
    }
  }, []);

  // Blur validation for Email
  const handleEmailBlur = useCallback(() => {
    setFieldErrors((previous) => ({ ...previous, email: validateLoginFields(email, password).email }));
  }, [email, password]);
  const handlePasswordBlur = useCallback(() => {
    setFieldErrors((previous) => ({ ...previous, password: validateLoginFields(email, password).password }));
  }, [email, password]);

  // Primary submission handler
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (submittingRef.current) {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState("network_offline");
      setErrorMessage("No network connection. Check your internet connection.");
      return;
    }

    const trimmedEmail = email.trim();
    const errors = validateLoginFields(trimmedEmail, password);
    if (errors.email || errors.password) {
      setFieldErrors(errors);
      setShakeField(errors.email ? "email" : "password");
      setTimeout(() => setShakeField(null), 350);
      return;
    }

    setState("validating");

    // Clear previous errors
    setErrorMessage(null);
    setFieldErrors({});

    setState("submitting");
    submittingRef.current = true;

    try {
      if (typeof localStorage !== "undefined") {
        clearAllSessionActivity(localStorage);
        localStorage.removeItem(SESSION_NOTICE_KEY);
      }

      // Execute Supabase Auth call (and sync via AuthContext if available)
      if (authContext && typeof authContext.login === "function") {
        await authContext.login(trimmedEmail, password);
      } else {
        await signInWithAccountProtection(trimmedEmail, password);
      }

      setState("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Your account is locked')) {
        setState("account_locked");
        setErrorMessage('Your account is locked. Contact an Admin to unlock it.');
        return;
      }

      if (
        msg.includes("Invalid login credentials") ||
        msg.includes("invalid_credentials") ||
        msg.includes("Invalid email or password")
        || msg.includes("Email or password is incorrect")
      ) {
        setState("invalid_credentials");
        setErrorMessage("Email or password is incorrect.");
        setShakeField("password");
        setTimeout(() => setShakeField(null), 350);
      } else if (msg.includes("network") || msg.includes("Failed to fetch")) {
        setState("network_offline");
        setErrorMessage("Network error: Unable to contact authentication servers.");
      } else {
        setState("server_error");
        setErrorMessage(/email.*not.*confirm/i.test(msg)
          ? "Confirm your email address before signing in."
          : "Unable to sign in right now. Please try again.");
      }
    } finally { submittingRef.current = false; }
  };

  const loginWithCredentials = async (loginEmail: string, loginPass: string) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setEmail(loginEmail);
    setPassword(loginPass);
    setState("submitting");
    setErrorMessage(null);
    setFieldErrors({});

    try {
      if (typeof localStorage !== "undefined") {
        clearAllSessionActivity(localStorage);
        localStorage.removeItem(SESSION_NOTICE_KEY);
      }

      if (authContext && typeof authContext.login === "function") {
        await authContext.login(loginEmail, loginPass);
      } else {
        await signInWithAccountProtection(loginEmail, loginPass);
      }

      setState("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const locked = msg.includes('Your account is locked');
      const invalid = /incorrect|Invalid email or password|Invalid login credentials/.test(msg);
      setState(locked ? 'account_locked' : invalid ? 'invalid_credentials' : 'server_error');
      setErrorMessage(locked ? 'Your account is locked. Contact an Admin to unlock it.' : invalid ? 'Email or password is incorrect.' : 'Unable to sign in right now. Please try again shortly.');
    } finally { submittingRef.current = false; }
  };

  const resetForm = useCallback(() => {
    setEmail("");
    setPassword("");
    setFieldErrors({});
    setErrorMessage(null);
    setState("idle");
  }, []);

  // CTA is disabled only when form is empty or during active submit / lockout
  const isSubmitDisabled =
    !email.trim() || !password || state === "submitting";

  return {
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    state,
    errorMessage,
    fieldErrors,
    capsLockActive,
    cooldownSeconds,
    shakeField,
    isSubmitDisabled,
    handleEmailBlur,
    handlePasswordBlur,
    handleKeyDown,
    handleSubmit,
    loginWithCredentials,
    resetForm,
  };
}
