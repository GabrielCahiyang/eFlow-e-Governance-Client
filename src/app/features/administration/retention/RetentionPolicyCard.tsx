import { Clock, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { blockInvalidNumberKey, maxDigitsForNumber } from "../../../shared/inputLimits";
import type { PublicArchiveMode, RetentionPolicy } from "./types";

const RETENTION_PRESETS = [
  { label: "10 years (COA financial)", days: 3650 },
  { label: "5 years (Standard LGU)", days: 1825 },
  { label: "3 years", days: 1095 },
  { label: "1 year", days: 365 },
  { label: "30 days (Testing)", days: 30 },
];

export function RetentionPolicyCard({
  draft,
  dirty,
  saving,
  onChange,
  onSave,
  onReset,
}: {
  draft: RetentionPolicy;
  dirty: boolean;
  saving: boolean;
  onChange: (next: RetentionPolicy) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  return (
    <form
      className="eflow-admin-card eflow-admin-settings-form space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className="eflow-admin-card__title-row">
        <span className="eflow-admin-icon-chip" aria-hidden="true">
          <Clock size={16} />
        </span>
        <div>
          <h2>Archive &amp; Retention Policy</h2>
          <p className="eflow-admin-copy">
            Controls how long completed projects wait before auto-archiving, and how long archived &amp;
            blockchain-sealed projects and receipts are kept before cleanup. Audit trails, financial ledgers,
            general journal entries, and Polygon Amoy certificates are always kept permanently.
          </p>
        </div>
      </div>

      <div className="eflow-retention-grid">
        <label>
          Auto-Archive After Completion (days)
          <input
            type="number"
            min={1}
            max={3650}
            step={1}
            required
            disabled={saving}
            value={draft.project_auto_archive_days}
            onKeyDown={(e) => blockInvalidNumberKey(e)}
            onChange={(e) => {
              const raw = e.target.value;
              const intDigits = raw.replace(/^-/, "").split(".")[0].replace(/^0+(?=\d)/, "");
              if (intDigits.length > maxDigitsForNumber(3650)) return;
              onChange({
                ...draft,
                project_auto_archive_days: Math.min(3650, Math.max(1, Number(raw) || 30)),
              });
            }}
          />
          <small>Completed projects auto-archive after this many days (default: 30 days).</small>
        </label>

        <label>
          Sealed Archive Retention Period (days)
          <input
            type="number"
            min={1}
            max={7300}
            step={1}
            required
            disabled={saving}
            value={draft.archive_retention_days}
            onKeyDown={(e) => blockInvalidNumberKey(e)}
            onChange={(e) => {
              const raw = e.target.value;
              const intDigits = raw.replace(/^-/, "").split(".")[0].replace(/^0+(?=\d)/, "");
              if (intDigits.length > maxDigitsForNumber(7300)) return;
              onChange({
                ...draft,
                archive_retention_days: Math.min(7300, Math.max(1, Number(raw) || 1825)),
              });
            }}
          />
          <div className="eflow-retention-presets" role="group" aria-label="Retention duration presets">
            {RETENTION_PRESETS.map((preset) => (
              <button
                key={preset.days}
                type="button"
                disabled={saving}
                className={`eflow-retention-preset ${
                  draft.archive_retention_days === preset.days ? "is-active" : ""
                }`}
                onClick={() => onChange({ ...draft, archive_retention_days: preset.days })}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <small>
            Countdown starts only after the project is both archived and confirmed on Polygon Amoy.
          </small>
        </label>

        <label>
          Pre-Purge Warning Notice (days before expiry)
          <input
            type="number"
            min={1}
            max={365}
            step={1}
            required
            disabled={saving}
            value={draft.archive_retention_notice_days}
            onKeyDown={(e) => blockInvalidNumberKey(e)}
            onChange={(e) => {
              const raw = e.target.value;
              const intDigits = raw.replace(/^-/, "").split(".")[0].replace(/^0+(?=\d)/, "");
              if (intDigits.length > maxDigitsForNumber(365)) return;
              onChange({
                ...draft,
                archive_retention_notice_days: Math.min(365, Math.max(1, Number(raw) || 30)),
              });
            }}
          />
          <small>Alerts Admin and the Office Head before an archived project reaches disposition.</small>
        </label>

        <label>
          Public Verification Portal (EflowPublic) Archive Handling
          <select
            disabled={saving}
            value={draft.archive_retention_public_mode}
            onChange={(e) =>
              onChange({
                ...draft,
                archive_retention_public_mode: e.target.value as PublicArchiveMode,
              })
            }
          >
            <option value="keep_manifest_purge_files">
              Keep public manifest JSON, purge receipt &amp; attachment files (Recommended)
            </option>
            <option value="purge_all_public">
              Purge all public storage files, keep on-chain certificate &amp; hash proof only
            </option>
            <option value="keep_full_public">
              Purge internal operational DB &amp; working storage only (keep full public archive)
            </option>
          </select>
          <small>
            Polygon Amoy transaction hash, block number, and SHA-256 manifest fingerprint always stay verifiable.
          </small>
        </label>
      </div>

      <div className="space-y-2.5 pt-1">
        <label className="eflow-admin-checkbox-row">
          <input
            type="checkbox"
            disabled={saving}
            checked={draft.archive_retention_require_seal}
            onChange={(e) =>
              onChange({ ...draft, archive_retention_require_seal: e.target.checked })
            }
          />
          <span>
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--eflow-text)]">
              <ShieldCheck size={14} aria-hidden="true" />
              Require confirmed Polygon Amoy blockchain seal before purge (Recommended)
            </span>
            <small>
              Blocks purging any archived project that has not yet been hashed and confirmed on-chain.
            </small>
          </span>
        </label>

        <label className="eflow-admin-checkbox-row">
          <input
            type="checkbox"
            disabled={saving}
            checked={draft.archive_retention_auto_purge}
            onChange={(e) =>
              onChange({ ...draft, archive_retention_auto_purge: e.target.checked })
            }
          />
          <span>
            <span className="block text-[13px] font-medium text-[var(--eflow-text)]">
              Enable automatic scheduled purge when retention expires
            </span>
            <small>
              When unchecked (default), expired projects are marked “Ready for purge” and wait for manual Admin approval.
            </small>
          </span>
        </label>
      </div>

      <div className="eflow-admin-actions pt-1">
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save Retention Policy"}
        </Button>
        {dirty && !saving && (
          <Button type="button" variant="outline" onClick={onReset}>
            <RotateCcw size={14} aria-hidden="true" />
            Reset changes
          </Button>
        )}
      </div>
    </form>
  );
}
