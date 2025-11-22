import { describe, test, expect } from "bun:test";
import { spawn } from "bun";
import {
  OK200_PATH,
  getPort,
  processes,
  setupCleanup,
  startOk200,
  startBackend,
} from "./helpers";

setupCleanup();

describe("ok200 - Edge Cases", () => {
  test("handles request with query string and headers", async () => {
    const port = getPort();
    const server = await startOk200([String(port)]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${port}/?foo=bar&baz=qux`, {
      headers: {
        "X-Custom-Header": "test",
        Accept: "application/json",
      },
    });

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });
});

describe("ok200 - HTTP Methods", () => {
  const methods = [
    "HEAD",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "OPTIONS",
  ] as const;

  for (const method of methods) {
    test(`handles ${method} request`, async () => {
      const port = getPort();
      const server = await startOk200([String(port)]);
      processes.push(server);

      const options: RequestInit = { method };
      if (method === "POST" || method === "PUT" || method === "PATCH") {
        options.body = "data";
      }

      const res = await fetch(`http://127.0.0.1:${port}/`, options);

      expect(res.status).toBe(200);
      if (method === "HEAD") {
        expect(res.headers.get("Content-Length")).toBe("2");
      }
    });
  }
});

describe("ok200 - Signal Handling", () => {
  test("graceful shutdown on SIGTERM", async () => {
    const port = getPort();
    const proc = spawn([OK200_PATH, String(port)], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await Bun.sleep(200);
    proc.kill("SIGTERM");
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
  });

  test("graceful shutdown on SIGINT", async () => {
    const port = getPort();
    const proc = spawn([OK200_PATH, String(port)], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await Bun.sleep(200);
    proc.kill("SIGINT");
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
  });
});

describe("ok200 - Client Disconnect", () => {
  test("server stays healthy after client aborts request", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const server = Bun.serve({
      port: backendPort,
      async fetch() {
        await Bun.sleep(500);
        return new Response("OK", { status: 200 });
      },
    });
    processes.push({
      proc: null,
      port: backendPort,
      kill: () => server.stop(),
    });

    const ok200 = await startOk200([
      "-b",
      String(backendPort),
      String(frontendPort),
    ]);
    processes.push(ok200);

    // Abort request before backend responds
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);

    try {
      await fetch(`http://127.0.0.1:${frontendPort}/`, {
        signal: controller.signal,
      });
    } catch {
      // Expected: AbortError
    }

    // Wait for backend to complete and verify server is still healthy
    await Bun.sleep(600);
    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });
});

describe("ok200 - Concurrent Requests", () => {
  test("handles 20 concurrent requests in simple mode", async () => {
    const port = getPort();
    const server = await startOk200([String(port)]);
    processes.push(server);

    const requests = Array.from({ length: 20 }, () =>
      fetch(`http://127.0.0.1:${port}/`),
    );

    const responses = await Promise.all(requests);

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("OK");
    }
  });

  test("handles 20 concurrent requests in backend mode", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackend(backendPort, 200);
    processes.push(backend);

    const server = await startOk200([
      "-b",
      String(backendPort),
      String(frontendPort),
    ]);
    processes.push(server);

    const requests = Array.from({ length: 20 }, () =>
      fetch(`http://127.0.0.1:${frontendPort}/`),
    );

    const responses = await Promise.all(requests);

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("OK");
    }
  });
});
