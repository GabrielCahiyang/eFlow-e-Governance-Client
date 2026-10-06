import { retryViewModule } from "./retryViewModule";
import { requestNavigation } from "./navigationGuard";
import {
  Component,
  Suspense,
  lazy,
  useState,
  type ComponentType,
  type ComponentProps,
  type ReactNode,
} from "react";

class ViewModuleLoadError extends Error {
  constructor() {
    super("This view could not be loaded.");
  }
}
class ViewLoadBoundary extends Component<
  { children: ReactNode; retry: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError(error: unknown) {
    // Runtime/business errors retain their owning boundary and draft handling.
    if (!(error instanceof ViewModuleLoadError)) throw error;
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert" className="rounded-lg border border-border bg-card p-4">
        <p>This view could not be loaded. Your current route is retained.</p>
        <button
          type="button"
          className="eflow-button mt-2"
          onClick={this.props.retry}
        >
          Retry loading view
        </button>
        <button
          type="button"
          className="eflow-button mt-2 ml-2"
          onClick={() => {
            void requestNavigation(() => location.reload());
          }}
        >
          Reload current page
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

/** Cache module code only. Each failed loader can be retried without reloading the app. */
export function lazyFeature<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  isActive?: (props: ComponentProps<T>) => boolean,
  retryExport?: string,
): T {
  const createView = (retry = false) =>
    lazy(() =>
      (retry && retryExport
        ? (retryViewModule(retryExport) as Promise<{ default: T }>)
        : loader()
      ).catch(() => {
        throw new ViewModuleLoadError();
      }),
    );
  const initialView = createView();
  return function DeferredFeature(props: ComponentProps<T>) {
    const [View, setView] = useState(() => initialView);
    const [attempt, setAttempt] = useState(0);
    if (isActive && !isActive(props)) return null;
    return (
      <ViewLoadBoundary
        key={attempt}
        retry={() => {
          setView(() => createView(true));
          setAttempt((value) => value + 1);
        }}
      >
        <Suspense
          fallback={
            <div role="status" className="p-4 text-sm text-muted-foreground">
              Loading view…
            </div>
          }
        >
          <View {...props} />
        </Suspense>
      </ViewLoadBoundary>
    );
  } as T;
}
