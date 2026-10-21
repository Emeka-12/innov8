"use client";

import { RefreshCw } from "lucide-react";

export interface RetryIndicatorProps {
  /** True while a retry is in flight. */
  isRetrying: boolean;
  /** 1-based number of the attempt currently in progress. */
  currentAttempt: number;
  /** Maximum attempts configured on the hook (used in the label). */
  maxAttempts: number;
  /** Milliseconds until the next retry fires, or null when not waiting. */
  nextRetryDelayMs?: number | null;
  className?: string;
}

/**
 * Small inline indicator consumed by useRetry callers.
 * Renders nothing when isRetrying is false.
 */
export function RetryIndicator({
  isRetrying,
  currentAttempt,
  maxAttempts,
  nextRetryDelayMs,
  className = "",
}: RetryIndicatorProps) {
  if (!isRetrying) return null;

  const delaySeconds =
    nextRetryDelayMs != null ? Math.ceil(nextRetryDelayMs / 1000) : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-1.5 text-xs font-medium text-status-warning ${className}`}
    >
      <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
      <span>
        Retry {currentAttempt} of {maxAttempts}
        {delaySeconds != null && delaySeconds > 0 && (
          <> &mdash; retrying in {delaySeconds}s</>
        )}
      </span>
    </div>
  );
}
