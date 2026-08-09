import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[Global ErrorBoundary Caught Exception]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  private handleGoDashboard = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full rounded-2xl border border-destructive/20 bg-card p-6 shadow-xl space-y-5 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertCircle className="size-8" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-foreground">Something went wrong.</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The application encountered an unexpected rendering error. Your data and sales remain safe.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-left font-mono text-[11px] text-muted-foreground break-words max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="rounded-xl text-xs font-semibold"
              >
                <RotateCcw className="size-3.5 mr-1.5" /> Retry
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={this.handleGoDashboard}
                className="rounded-xl text-xs font-semibold"
              >
                <Home className="size-3.5 mr-1.5" /> Dashboard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={this.handleReload}
                className="rounded-xl text-xs font-semibold bg-primary text-primary-foreground"
              >
                <RefreshCw className="size-3.5 mr-1.5" /> Reload
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
