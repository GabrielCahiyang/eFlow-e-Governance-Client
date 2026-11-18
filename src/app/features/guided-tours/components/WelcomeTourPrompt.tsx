import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { Button } from "../../../components/ui/button";
import { WorkspaceIllustration } from "../../../components/ui/WorkspaceIllustration";
import "../../onboarding/onboarding.css";

export function WelcomeTourPrompt({
  roleLabel,
  onLater,
  nextSteps = [],
  onNextStep,
}: {
  roleLabel: string;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  onStart?: () => void;
  onLater: () => void;
  nextSteps?: { id: string; label: string; page: string; description: string }[];
  onNextStep?: (section: string, page: string) => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onLater(); }}>
      <DialogContent className="eflow-onboarding-dialog">
        <section>
          <span className="eflow-onboarding-wordmark">eFlow.</span>
          <p className="eflow-eyebrow">A NEW WAY TO WORK TOGETHER</p>
          <DialogTitle>Welcome to eFlow.</DialogTitle>
          <DialogDescription>
            Your {roleLabel} workspace is ready. Explore your key destinations below or enter your workspace directly.
          </DialogDescription>
          {nextSteps.length > 0 && (
            <div className="eflow-onboarding-options">
              {nextSteps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onNextStep ? onNextStep(step.id, step.page) : onLater()}
                  className="flex w-full items-center justify-between rounded-lg border border-[var(--eflow-border)] bg-[var(--eflow-surface)] p-3 text-left transition-colors hover:bg-[var(--eflow-subtle)]"
                >
                  <span>
                    <span className="block text-[13px] font-semibold text-[var(--eflow-text)]">{step.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--eflow-text-muted)]">{step.description}</span>
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-[var(--eflow-primary)]" />
                </button>
              ))}
            </div>
          )}
          <footer>
            <Button variant="ghost" onClick={onLater}>Skip for now</Button>
            <Button onClick={onLater}>
              Enter your workspace <ArrowRight size={16} />
            </Button>
          </footer>
        </section>
        <WorkspaceIllustration />
      </DialogContent>
    </Dialog>
  );
}
