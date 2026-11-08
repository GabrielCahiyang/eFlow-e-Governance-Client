import "@vibe/core/tokens";
import "@fontsource-variable/figtree/wght.css";
import "@fontsource-variable/figtree/wght-italic.css";
import "../../../../../styles/index.css";
import { createRoot } from "react-dom/client";
import { installPreviewIsolation } from "./isolation";
import { sampleRecords } from "./sampleRecords";
import { initializeSampleSession, installSampleTransport } from "./sampleTransport";
import { prepareScene, sceneRoute } from "./prepareScene";
import { WORKFLOW_WALKTHROUGHS } from "../walkthroughSteps";

async function start() {
  const scene = new URLSearchParams(location.search).get("scene") || "";
  if (!Object.values(WORKFLOW_WALKTHROUGHS).some(steps => steps.some(step => step.id === scene))) throw new Error("Unknown walkthrough scene.");
  installPreviewIsolation();
  const records = sampleRecords(scene);
  initializeSampleSession(records);
  installSampleTransport(records);
  history.replaceState({}, "", sceneRoute(scene));
  const { default: App } = await import("../../../../App");
  createRoot(document.getElementById("root")!).render(<App />);
  await prepareScene(scene);
  document.body.dataset.walkthroughReady = scene;
  parent.postMessage({ type: "eflow-walkthrough-ready", scene }, location.origin);
}
void start().catch(error => {
  document.body.dataset.walkthroughError = error instanceof Error ? error.message : "Could not open this scene.";
  parent.postMessage({ type: "eflow-walkthrough-error", message: error instanceof Error ? error.message : "Could not open this scene." }, location.origin);
});

