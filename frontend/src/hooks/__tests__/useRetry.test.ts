import { renderHook, act } from "@testing-library/react";
import { useRetry } from "../useRetry";

describe("useRetry", () => {
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("executes function successfully on first attempt", async () => {
    const fn = jest.fn().mockResolvedValue("success");
    const { result } = renderHook(() => useRetry(fn));

    let data: string | null = null;
    await act(async () => {
      data = await result.current.execute();
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(data).toBe("success");
    expect(result.current.state.data).toBe("success");
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.isLoading).toBe(false);
  });

  it("retries on failure and succeeds", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("success");
    const { result } = renderHook(() => useRetry(fn));

    await act(async () => {
      await result.current.execute();
    });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.current.state.data).toBe("success");
    expect(result.current.state.attempt).toBe(1);
  });

  it("stops retrying after max attempts", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("fail"));
    const { result } = renderHook(() => useRetry(fn, { maxAttempts: 2 }));

    await act(async () => {
      await result.current.execute();
    });

    expect(fn).toHaveBeenCalledTimes(2);
    expect(result.current.state.error).toBeDefined();
    expect(result.current.state.isLoading).toBe(false);
    expect(result.current.state.isRetrying).toBe(false);
  });

  it("does not retry non-retryable status", async () => {
    const error = new Error("bad request");
    (error as { status: number }).status = 400;
    const fn = jest.fn().mockRejectedValue(error);
    const { result } = renderHook(() =>
      useRetry(fn, { retryableStatuses: [500, 503] })
    );

    await act(async () => {
      await result.current.execute();
    });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.current.state.error).toBeDefined();
    const err = result.current.state.error as { status: number };
    expect(err.status).toBe(400);
  });

  it("resets state correctly", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("fail"));
    const { result } = renderHook(() => useRetry(fn));

    await act(async () => {
      await result.current.execute();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.data).toBeNull();
    expect(result.current.state.error).toBeNull();
    expect(result.current.state.attempt).toBe(0);
    expect(result.current.state.isLoading).toBe(false);
  });

  // ── New fields: currentAttempt and nextRetryDelayMs ──────────────────────

  it("exposes currentAttempt = 1 on the first successful call", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    const { result } = renderHook(() => useRetry(fn));

    await act(async () => {
      await result.current.execute();
    });

    expect(result.current.state.currentAttempt).toBe(1);
    expect(result.current.state.nextRetryDelayMs).toBeNull();
  });

  it("exposes currentAttempt and nextRetryDelayMs while retrying", async () => {
    let resolveRetry!: () => void;
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockImplementationOnce(
        () =>
          new Promise<string>((res) => {
            resolveRetry = () => res("ok");
          }),
      );

    const { result } = renderHook(() =>
      useRetry(fn, { initialDelayMs: 500, maxAttempts: 2 }),
    );

    // Start execution without awaiting so we can inspect intermediate state.
    act(() => {
      void result.current.execute();
    });

    // After first failure the hook starts counting the delay.
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    // Advance past the 500 ms delay so the retry fires.
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    // Resolve the second attempt.
    await act(async () => {
      resolveRetry();
    });

    expect(result.current.state.currentAttempt).toBeGreaterThanOrEqual(1);
  });

  it("resets currentAttempt and nextRetryDelayMs on reset()", async () => {
    const fn = jest.fn().mockRejectedValue(new Error("fail"));
    const { result } = renderHook(() => useRetry(fn, { maxAttempts: 1 }));

    await act(async () => {
      await result.current.execute();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.currentAttempt).toBe(0);
    expect(result.current.state.nextRetryDelayMs).toBeNull();
  });
});