import { useState } from "react";
import { AttentionBox, Button } from "@vibe/core";
import * as m from "motion/react-m";
import { Check, RotateCcw } from "lucide-react";
import { BxSliderAlt, BxsBolt, BxsCheckShield } from "../../../components/ui/boxicons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
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
  const [value, setValue] = useState(currentThreshold);
  const [error, setError] = useState("");

  const handleSave = () => {
    if (value <= 0 || !Number.isFinite(value)) {
      setError("Please enter a valid amount greater than ₱0.");
      return;
    }
    onSave(value);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BxSliderAlt size={18} className="text-neutral-700" />
            Approval Tier Threshold
          </DialogTitle>
          <DialogDescription className="text-[11.5px] text-neutral-500">
            Set the maximum amount for Tier 1 Fast-Track requests. Requests equal to or below this amount are flagged for single-tier fast-track clearance.
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
            <label className="text-[11px] font-medium text-neutral-700">
              Fast-Track Maximum Limit
            </label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-neutral-400">
                ₱
              </span>
              <input
                type="number"
                min={1}
                step={100}
                value={value || ""}
                onChange={(e) => {
                  setError("");
                  setValue(Number(e.target.value));
                }}
                className="h-10 w-full rounded-xl border border-neutral-200 pl-8 pr-3 text-[13px] font-medium text-neutral-900 outline-none focus:border-neutral-900"
                placeholder="1000"
              />
            </div>
            {error && <p className="mt-1 text-[10.5px] text-rose-600">{error}</p>}
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
                    setError("");
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
            title="Governance Routing Rule"
            text={`Expenses at or below ${peso.format(value || 0)} are fast-tracked for immediate release upon Team Leader endorsement. Requests above this threshold escalate to the Head.`}
          />

          {/* Visual comparison cards */}
          <div className="space-y-2 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3 text-[10.5px]">
            <div className="flex items-start gap-2 text-emerald-800">
              <div className="mt-0.5 rounded p-1 bg-emerald-100 text-emerald-700">
                <BxsBolt size={12} />
              </div>
              <div>
                <strong className="font-semibold">Tier 1 (≤ {peso.format(value || 0)}):</strong>
                <p className="mt-0.5 text-neutral-600">
                  Micro-expenses and day-to-day operational supplies.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 text-amber-800 border-t border-neutral-200/60 pt-2">
              <div className="mt-0.5 rounded p-1 bg-amber-100 text-amber-700">
                <BxsCheckShield size={12} />
              </div>
              <div>
                <strong className="font-semibold">Tier 2 (&gt; {peso.format(value || 0)}):</strong>
                <p className="mt-0.5 text-neutral-600">
                  Major commitments requiring full multi-tier governance.
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
              setError("");
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
            <Button
              kind="primary"
              size="small"
              onClick={handleSave}
            >
              <Check size={12} className="mr-1" />
              Save Threshold
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
