import { Person, Close } from "@vibe/icons";
import {
  QUICK_LOGIN_ACCOUNTS,
  type QuickLoginAccount,
} from "../../app/shared/quickLoginAccounts";
import styles from "./Login.module.scss";

export interface UsageScenariosModalProps {
  show: boolean;
  onClose: () => void;
  onSelectAccount: (account: QuickLoginAccount) => void;
}

export function UsageScenariosModal({
  show,
  onClose,
  onSelectAccount,
}: UsageScenariosModalProps) {
  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="usage-scenarios-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(4px)",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.scenariosDialog}
        style={{
          width: "100%",
          maxWidth: "460px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 20px 45px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.08)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px 16px 24px",
            borderBottom: "1px solid #f1f5f9",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "4px",
            }}
          >
            <h3
              id="usage-scenarios-title"
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 700,
                color: "#0f172a",
                letterSpacing: "-0.01em",
              }}
            >
              Development Usage Scenarios
            </h3>
            <button
              type="button"
              aria-label="Close dialog"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "8px",
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f1f5f9";
                e.currentTarget.style.color = "#0f172a";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "#64748b";
              }}
            >
              <Close size={18} />
            </button>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#475569",
              lineHeight: 1.4,
            }}
          >
            Select a pre-configured LGU role account to inspect office workspaces and role permissions.
          </p>
        </div>

        {/* Account List */}
        <div
          role="menu"
          aria-label="Development accounts"
          className={styles.scenariosList}
          style={{
            padding: "16px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "360px",
            overflowY: "auto",
          }}
        >
          {QUICK_LOGIN_ACCOUNTS.map((account) => (
            <button
              className={styles.scenarioAccount}
              key={account.email}
              role="menuitem"
              type="button"
              aria-label={`${account.label} — ${account.email}`}
              onClick={() => {
                onSelectAccount(account);
                onClose();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                cursor: "pointer",
                transition: "all 0.15s ease",
                textAlign: "left",
                outline: "none",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f8fafc";
                e.currentTarget.style.borderColor = "#0073ea";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
                e.currentTarget.style.borderColor = "#e2e8f0";
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#0073ea";
                e.currentTarget.style.boxShadow = "0 0 0 2px rgba(0, 115, 234, 0.2)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#e2e8f0";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    backgroundColor: "#eff6ff",
                    color: "#0073ea",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                >
                  <Person size={18} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <strong style={{ fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>
                    {account.label}
                  </strong>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    {account.email}
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#334155",
                  backgroundColor: "#f1f5f9",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {account.roleLabel}
              </span>
            </button>
          ))}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "flex-end",
            backgroundColor: "#f8fafc",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              backgroundColor: "#0073ea",
              color: "#ffffff",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#0060b9")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#0073ea")}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
