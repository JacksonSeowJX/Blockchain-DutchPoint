import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount whatever a test rendered and clear what it kept in the browser, so the next test starts afresh.
afterEach(() => {
  cleanup();
  localStorage.clear();
});
