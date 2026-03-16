export type InitControllerOptions = {
  retryDelayMs?: number;
  retryOnFailureDelayMs?: number;
};

export type InitAttemptResult = {
  success: boolean;
  retryDelayMs?: number;
};

type InitRunner = () => Promise<InitAttemptResult>;

export function getPywebviewApi<T>(): T | null {
  return (window.pywebview?.api as T | undefined) ?? null;
}

export async function waitForPywebviewApi<T>(timeoutMs = 4000): Promise<T | null> {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = (): void => {
      const api = getPywebviewApi<T>();
      if (api) {
        resolve(api);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }
      window.requestAnimationFrame(tick);
    };
    tick();
  });
}

export function createRetryingPageInit(
  runner: InitRunner,
  options: InitControllerOptions = {}
): () => void {
  const { retryDelayMs = 500, retryOnFailureDelayMs = 1000 } = options;
  let initialized = false;
  let initInFlight = false;
  let initRetryTimeout: number | null = null;

  const scheduleRetry = (delayMs: number): void => {
    if (initialized || initInFlight || initRetryTimeout !== null) {
      return;
    }

    initRetryTimeout = window.setTimeout(() => {
      initRetryTimeout = null;
      void init();
    }, delayMs);
  };

  const init = async (): Promise<void> => {
    if (initialized || initInFlight) {
      return;
    }

    initInFlight = true;
    let nextRetryDelayMs: number | null = null;
    try {
      const result = await runner();
      if (result.success) {
        initialized = true;
        return;
      }
      nextRetryDelayMs = result.retryDelayMs ?? retryDelayMs;
    } catch {
      nextRetryDelayMs = retryOnFailureDelayMs;
    } finally {
      initInFlight = false;
      if (!initialized && nextRetryDelayMs !== null) {
        scheduleRetry(nextRetryDelayMs);
      }
    }
  };

  return () => {
    void init();
  };
}
