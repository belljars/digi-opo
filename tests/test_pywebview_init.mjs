import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const windowStub = {
  pywebview: undefined,
  requestAnimationFrame(callback) {
    return setTimeout(callback, 0);
  },
  setTimeout,
  clearTimeout,
};

globalThis.window = windowStub;

const { createRetryingPageInit, waitForPywebviewApi } = await import("../src/ui/scripts/pywebview-init.js");

async function testDelayedApiReadiness() {
  let attempts = 0;

  const initPage = createRetryingPageInit(async () => {
    attempts += 1;
    const api = await waitForPywebviewApi(5);
    if (!api) {
      return { success: false, retryDelayMs: 10 };
    }
    return { success: true };
  });

  initPage();

  await delay(15);
  windowStub.pywebview = { api: { ready: true } };

  await delay(80);

  assert.equal(attempts, 2, "init should retry once and then succeed after API becomes available");
}

await testDelayedApiReadiness();
console.log("test_pywebview_init.mjs passed");
