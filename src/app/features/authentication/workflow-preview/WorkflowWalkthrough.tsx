import { useEffect, useRef, useState } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import type { PreviewTourStep } from "./walkthroughSteps";
import styles from "./WorkflowWalkthrough.module.scss";

const screenWidth = 1440;
const screenHeight = 1000;

export function WorkflowWalkthrough({ step, onReady }: { step: PreviewTourStep; onReady: (scene: string) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(.5);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const element = viewport.current!;
    const measure = () => setScale(Math.min(element.clientWidth / screenWidth, element.clientHeight / screenHeight));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setReady(false);
    setError("");
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== location.origin) return;
      if (event.data?.type === "eflow-walkthrough-ready" && event.data.scene === step.id) {
        setReady(true);
        onReady(step.id);
      }
      if (event.data?.type === "eflow-walkthrough-error") setError("Could not load this walkthrough screen.");
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [step.id, onReady, attempt]);

  return <div className={styles.stage} data-preview-screen={step.id}>
    <div className={styles.film} ref={viewport}>
      <div className={styles.screenWindow} ref={element => { element?.setAttribute("inert", ""); }} style={{ width: screenWidth * scale, height: screenHeight * scale, opacity: ready ? 1 : 0 }}>
        <iframe ref={frame} key={attempt} title="eFlow sample screen" tabIndex={-1}
          src={import.meta.env.BASE_URL + "walkthrough.html?scene=" + step.id}
          sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer"
          style={{ width: screenWidth, height: screenHeight, transform: `scale(${scale})` }} />
      </div>
      {!ready && <div className={styles.loading} role={error ? "alert" : "status"}>
        {error ? <><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}><RotateCcw size={16} />Retry screen</button></>
          : <><LoaderCircle size={24} className={styles.spinner} /><span>Opening eFlow screen…</span></>}
      </div>}
    </div>
    <section className={styles.caption} aria-label="Scene caption">
      <p className={styles.chapter}>{step.chapter} <span>·</span> {step.actor}</p>
      <h2>{step.title}</h2>
      <p>{step.description}</p>
    </section>
  </div>;
}
