import { Button, IconButton, Tooltip } from "@vibe/core";
import { Help, NavigationArrow } from "@vibe/icons";
import { useGuidedTour } from "./GuidedTourProvider";

export function PageWalkthroughButton() {
  const { isTourActive, startPageTour } = useGuidedTour();
  return (
    <span data-tour-id="page-walkthrough">
      <Button
        aria-label="Walkthrough"
        disabled={isTourActive}
        kind="tertiary"
        leftIcon={Help}
        onClick={startPageTour}
      >
        Tab Walkthrough
      </Button>
    </span>
  );
}

export function SystemWalkthroughButton({
  collapsed,
  onBeforeStart,
}: {
  collapsed: boolean;
  onBeforeStart?: () => void;
}) {
  const { isTourActive, startSystemTour } = useGuidedTour();
  const start = () => {
    onBeforeStart?.();
    window.setTimeout(startSystemTour, collapsed ? 260 : 0);
  };
  if (collapsed) {
    return (
      <span data-tour-id="system-walkthrough">
        <Tooltip content="Start walkthrough">
          <IconButton
            aria-label="Start walkthrough"
            disabled={isTourActive}
            icon={NavigationArrow}
            kind="tertiary"
            onClick={start}
          />
        </Tooltip>
      </span>
    );
  }

  return (
    <span data-tour-id="system-walkthrough">
      <Button
        disabled={isTourActive}
        kind="tertiary"
        leftIcon={NavigationArrow}
        onClick={start}
      >
        Start walkthrough
      </Button>
    </span>
  );
}
