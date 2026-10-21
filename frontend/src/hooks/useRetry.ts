"use client";

import { useCallback, useMemo, useRef, useState } from "react";

export interface RetryConfig {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
}

export interface RetryState<T> {
  data: T | null;
  isLoading: boolean;
  isRetrying: boolean;
  error: Error | null;
  attempt: number;
  /** 1-based attempt number shown to the user (0 when not yet started). */
  currentAttempt: number;
  /** Milliseconds until the next retry fires; null when not retrying. */
  nextRetryDelayMs: number | null;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export function useRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): {
  execute: () => Promise<T | null>;
  state: RetryState<T>;
  reset: () => void;
} {
  const resolvedConfig = useMemo(() => ({ ...DEFAULT_CONFIG, ...config }), [config]);
  const [state, setState] = useState<RetryState<T>>({
    data: null,
    isLoading: false,
    isRetrying: false,
    error: null,
    attempt: 0,
    currentAttempt: 0,
    nextRetryDelayMs: null,
  });
  const attemptRef = useRef(0);

  const calculateDelay = useCallback(
    (attempt: number) => {
      const delay = resolvedConfig.initialDelayMs *
        Math.pow(resolvedConfig.backoffMultiplier, attempt);
      return Math.min(delay, resolvedConfig.maxDelayMs);
    },
    [resolvedConfig]
  );

  const isRetryable = useCallback(
    (error: Error): boolean => {
      if ("status" in error && typeof (error as { status?: number }).status === "number") {
        return resolvedConfig.retryableStatuses.includes(
          (error as { status: number }).status
        );
      }
      return true;
    },
    [resolvedConfig]
  );

  const reset = useCallback(() => {
    setState({
      data: null,
      isLoading: false,
      isRetrying: false,
      error: null,
      attempt: 0,
      currentAttempt: 0,
      nextRetryDelayMs: null,
    });
    attemptRef.current = 0;
  }, []);

  const execute = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      currentAttempt: 1,
      nextRetryDelayMs: null,
    }));

    for (let attempt = 0; attempt <= resolvedConfig.maxAttempts; attempt++) {
      attemptRef.current = attempt;

      try {
        const data = await fn();

        setState({
          data,
          isLoading: false,
          isRetrying: false,
          error: null,
          attempt,
          currentAttempt: attempt + 1,
          nextRetryDelayMs: null,
        });

        return data;
      } catch (error) {
        const isLastAttempt = attempt >= resolvedConfig.maxAttempts - 1;
        const shouldRetry = !isLastAttempt && isRetryable(error as Error);

        if (!shouldRetry) {
          setState({
            data: null,
            isLoading: false,
            isRetrying: false,
            error: error as Error,
            attempt,
            currentAttempt: attempt + 1,
            nextRetryDelayMs: null,
          });
          return null;
        }

        const delay = calculateDelay(attempt);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRetrying: true,
          attempt: attempt + 1,
          currentAttempt: attempt + 2,
          nextRetryDelayMs: delay,
        }));

        await new Promise((resolve) => setTimeout(resolve, delay));

        setState((prev) => ({
          ...prev,
          nextRetryDelayMs: null,
        }));
      }
    }

    return null;
  }, [fn, resolvedConfig, calculateDelay, isRetryable]);

  return { execute, state, reset };
}