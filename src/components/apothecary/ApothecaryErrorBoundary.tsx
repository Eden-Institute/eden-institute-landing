import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic error boundary for the Apothecary layout. Renders a single "Something
 * went wrong — refresh" fallback per §23.7 decision lock. Per-surface custom
 * fallbacks are out of scope for Stage 3; wire them in later stages if needed.
 */
export class ApothecaryErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("ApothecaryErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center px-6">
          <div className="max-w-md text-center space-y-4">
            <AlertTriangle
              className="w-10 h-10 mx-auto"
              style={{ color: "hsl(var(--eden-gold))" }}
            />
            <h2
              className="font-serif text-2xl font-semibold"
              style={{ color: "hsl(var(--eden-bark))" }}
            >
              Something went wrong
            </h2>
            <p className="font-body text-sm text-muted-foreground">
              We hit an unexpected error. Please refresh to try again. If the
              problem persists, let us know.
            </p>
            <Button variant="eden" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
