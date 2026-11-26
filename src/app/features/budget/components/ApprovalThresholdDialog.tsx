import { useId, useState } from "react";
import { AttentionBox, Button } from "@vibe/core";
import * as m from "motion/react-m";
import { Check, RotateCcw } from "lucide-react";
import { MoneyInput } from "../../../components/ui/MoneyInput";
import { ActionBlockerGroup } from "../../../components/ui/action-blockers";
import { BxSliderAlt, BxsBolt, BxsCheckShield } from "../../../components/ui/boxicons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { exceedsCentavos, formatPeso, toCentavos } from "../../../shared/currency";
import { INPUT_LIMITS } from "../../../shared/inputLimits";
import { motionTransition } from "../../../shared/motion/motionTokens";
import { peso } from "./budgetUi";

const PRESET_AMOUNTS = [500, 1_000, 2_000, 5_000];

export function ApprovalThresholdDialog({
  currentThreshold,
  defaultThreshold,
  onClose,
  onSave,
}: {
  currentThreshold: number;
  defaultThreshold: number;
  onClose: () => void;
  onSave: (amount: number) => void;
}) {
  const inputId = useId();
  const [value, setValue] = useState(currentThreshold);
  const [touched, setTouched] = useState(false);

  const overBudgetMax = Number.isFinite(value) && exceedsCentavos(value, INPUT_LIMITS.MONEY_MAX_BUDGET);
  const validationError =
    !Number.isFinite(value) || toCentavos(value) < 100
      ? "Enter a valid amount of at least ₱1.00."
      : overBudgetMax
        ? `Amount cannot exceed ${formatPeso(INPUT_LIMITS.MONEY_MAX_BUDGET)}.`
        : "";
  const visibleError = touched || overBudgetMax ? validationError : "";
  const saveDisabled = Boolean(validationError);

  const handleSave = () => {
    setTouched(true);
    if (validationError) return;
    onSave(value);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BxSliderAlt size={18} className="text-neutral-700" />
            Quick-approval limit
          </DialogTitle>
          <DialogDescription className="text-[11.5px] text-neutral-500">
            Set the maximum amount for requests that can be approved together in one click.
          </DialogDescription>
        </DialogHeader>

        <m.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionTransition.productive}
          className="space-y-4 py-2"
        >
          {/* Amount input */}
          <div>
            <label htmlFor={inputId} className="text-[11px] font-medium text-neutral-700">
              Maximum amount for quick approval{" "}
              <span className="text-[var(--eflow-negative-text)]" aria-hidden="true">
                *
              </span>
            </label>
            <div className="relative mt-1">
              <span
                className="pointer-events-none absolute left-3 top-5 -translate-y-1/2 text-[12px] font-semibold text-neutral-400"
                aria-hidden="true"
              >
                ₱
              </span>
              <MoneyInput
                id={inputId}
                min={1}
                max={INPUT_LIMITS.MONEY_MAX_BUDGET}
                availableMax={INPUT_LIMITS.MONEY_MAX_BUDGET}
                showCeilingHint
                externalError={visibleError || undefined}
                aria-required="true"
                step={100}
                value={value || ""}
                onBlur={() => setTouched(true)}
                onValueChange={(raw) => {
                  setTouched(true);
                  setValue(raw === "" ? 0 : Number(raw));
                }}
                className="h-10 w-full rounded-xl border border-neutral-200 pl-8 pr-3 text-[13px] font-medium text-neutral-900 outline-none focus:border-neutral-900"
                placeholder="1000"
              />
            </div>
          </div>

          {/* Preset buttons */}
          <div>
            <span className="text-[9.5px] text-neutral-400 uppercase tracking-wider font-semibold">
              Quick Presets
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setTouched(true);
                    setValue(preset);
                  }}
                  className={`inline-flex h-7 items-center rounded-lg px-2.5 text-[10.5px] font-medium transition ${
                    value === preset
                      ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                      : "border border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {peso.format(preset)}
                </button>
              ))}
            </div>
          </div>

          {/* AttentionBox explanation */}
          <AttentionBox
            type="neutral"
            title="How this limit works"
            text={`Requests at or below ${peso.format(value || 0)} can be approved together in one click. Larger requests require individual review.`}
          />

          {/* Visual comparison cards */}
          <div className="space-y-2 rounded-[10px] border border-neutral-200 bg-neutral-50/70 p-3 text-[11px]">
            <div className="flex items-start gap-2 text-emerald-800">
              <div className="mt-0.5 rounded-[5px] bg-emerald-100 p-1 text-emerald-700">
                <BxsBolt size={12} />
              </div>
              <div>
                <strong className="font-semibold">Under limit (≤ {peso.format(value || 0)}):</strong>
                <p className="mt-0.5 text-neutral-600">
                  Day-to-day supplies and small operational requests.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 border-t border-neutral-200/60 pt-2 text-amber-800">
              <div className="mt-0.5 rounded-[5px] bg-amber-100 p-1 text-amber-700">
                <BxsCheckShield size={12} />
              </div>
              <div>
                <strong className="font-semibold">Over limit (&gt; {peso.format(value || 0)}):</strong>
                <p className="mt-0.5 text-neutral-600">
                  Larger requests reviewed individually before release.
                </p>
              </div>
            </div>
          </div>
        </m.div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button
            kind="tertiary"
            size="small"
            onClick={() => {
              setValue(defaultThreshold);
              setTouched(false);
            }}
          >
            <RotateCcw size={11} className="mr-1" />
            Reset default ({peso.format(defaultThreshold)})
          </Button>
          <div className="flex gap-2">
            <Button
              kind="secondary"
              size="small"
              onClick={onClose}
            >
              Cancel
            </Button>
            <ActionBlockerGroup
              actionLabel="Save limit"
              blockers={saveDisabled ? validationError : []}
              size="sm"
            >
              <Button
                kind="primary"
                size="small"
                disabled={saveDisabled}
                onClick={handleSave}
              >
                <Check size={12} className="mr-1" />
                Save limit
              </Button>
            </ActionBlockerGroup>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
