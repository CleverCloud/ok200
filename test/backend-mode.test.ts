import { describe, test, expect } from "bun:test";
import {
  getPort,
  processes,
  setupCleanup,
  startOk200,
  startBackend,
  startBackendWithPath,
} from "./helpers";

setupCleanup();

describe("ok200 - Backend Mode", () => {
  test("returns OK when backend returns 200", async () => {
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

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("returns OK when backend returns 201", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackend(backendPort, 201);
    processes.push(backend);

    const server = await startOk200([
      "-b",
      String(backendPort),
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test.each([
    [301, "3xx redirect"],
    [404, "4xx client error"],
    [500, "5xx server error"],
  ])("returns Not OK when backend returns %i (%s)", async (statusCode) => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackend(backendPort, statusCode);
    processes.push(backend);

    const server = await startOk200([
      "-b",
      String(backendPort),
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(503);
    expect(await res.text()).toBe("Not OK");
  });

  test("returns Not OK (503) when backend is down", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const server = await startOk200([
      "-b",
      String(backendPort),
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(503);
    expect(await res.text()).toBe("Not OK");
  });

  test("Content-Length is 6 for Not OK response", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const server = await startOk200([
      "-b",
      String(backendPort),
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.headers.get("Content-Length")).toBe("6");
  });
});

describe("ok200 - Backend Mode Edge Cases", () => {
  test("returns OK when backend returns 299 (boundary)", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const server = Bun.serve({
      port: backendPort,
      fetch() {
        return new Response("OK", { status: 299 });
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

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("returns Not OK when backend returns 300 (boundary)", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const server = Bun.serve({
      port: backendPort,
      fetch() {
        return new Response("Redirect", { status: 300 });
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

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(503);
  });

  test("backend mode handles slow backend (500ms)", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const server = Bun.serve({
      port: backendPort,
      async fetch() {
        await Bun.sleep(500);
        return new Response("Slow OK", { status: 200 });
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

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("backend returning empty body with 200 is OK", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const server = Bun.serve({
      port: backendPort,
      fetch() {
        return new Response("", { status: 200 });
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

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("handles backend that responds slowly but within timeout", async () => {
    // MG_IO_TIMEOUT applies to I/O inactivity, not total request duration
    // A backend that sleeps then responds keeps the connection alive
    const backendPort = getPort();
    const frontendPort = getPort();

    const server = Bun.serve({
      port: backendPort,
      async fetch() {
        await Bun.sleep(2000);
        return new Response("Slow but OK", { status: 200 });
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

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  }, 10000);

  test("handles long backend path (200 chars)", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();
    const longPath = "/" + "a".repeat(200);

    const server = Bun.serve({
      port: backendPort,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === longPath) {
          return new Response("OK", { status: 200 });
        }
        return new Response("Not Found", { status: 404 });
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
      "-p",
      longPath,
      String(frontendPort),
    ]);
    processes.push(ok200);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("handles path near BUFFER_SIZE limit (230 chars)", async () => {
    // BUFFER_SIZE is 256. URL format: "http://127.0.0.1:PORT/path"
    // Prefix "http://127.0.0.1:XXXXX" is max 24 chars, leaving ~230 for path
    const backendPort = getPort();
    const frontendPort = getPort();
    const longPath = "/" + "x".repeat(229);

    const server = Bun.serve({
      port: backendPort,
      fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === longPath) {
          return new Response("OK", { status: 200 });
        }
        return new Response("Not Found", { status: 404 });
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
      "-p",
      longPath,
      String(frontendPort),
    ]);
    processes.push(ok200);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("path exceeding BUFFER_SIZE (260+ chars) is truncated gracefully", async () => {
    // BUFFER_SIZE is 256, so paths > ~230 chars will be truncated by snprintf
    // Server should not crash, but may return 503 due to path mismatch
    const backendPort = getPort();
    const frontendPort = getPort();
    const overflowPath = "/" + "y".repeat(260);

    const server = Bun.serve({
      port: backendPort,
      fetch(req) {
        const url = new URL(req.url);
        // Backend expects the full path, but ok200 will send truncated version
        if (url.pathname === overflowPath) {
          return new Response("OK", { status: 200 });
        }
        // Truncated path won't match, return 404
        return new Response("Not Found", { status: 404 });
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
      "-p",
      overflowPath,
      String(frontendPort),
    ]);
    processes.push(ok200);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    // Should return 503 because truncated path won't match backend expectation
    // The important thing is that it doesn't crash
    expect(res.status).toBe(503);
    expect(await res.text()).toBe("Not OK");
  });

  test("returns Not OK when backend closes connection without response", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    // Create a raw TCP server that accepts then immediately closes
    const server = Bun.listen({
      hostname: "127.0.0.1",
      port: backendPort,
      socket: {
        open(socket) {
          // Close immediately without sending anything
          socket.end();
        },
        data() {},
        close() {},
        error() {},
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

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(503);
    expect(await res.text()).toBe("Not OK");
  });

  test("returns Not OK when backend sends malformed HTTP response", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    // Create a raw TCP server that sends garbage
    const server = Bun.listen({
      hostname: "127.0.0.1",
      port: backendPort,
      socket: {
        open(socket) {
          // Send malformed HTTP response
          socket.write("THIS IS NOT HTTP\r\n\r\n");
          socket.end();
        },
        data() {},
        close() {},
        error() {},
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

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(503);
    expect(await res.text()).toBe("Not OK");
  });
});

describe("ok200 - Backend Path Option (-p)", () => {
  test("-p option checks custom path on backend", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/health": 200,
      "/": 404,
    });
    processes.push(backend);

    const server = await startOk200([
      "-b",
      String(backendPort),
      "-p",
      "/health",
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("-p with path that returns error gives Not OK", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/health": 500,
      "/": 200,
    });
    processes.push(backend);

    const server = await startOk200([
      "-b",
      String(backendPort),
      "-p",
      "/health",
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(503);
    expect(await res.text()).toBe("Not OK");
  });

  test("-p path without leading slash is normalized", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/status": 200,
    });
    processes.push(backend);

    const server = await startOk200([
      "-b",
      String(backendPort),
      "-p",
      "status",
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("default path is / when -p not specified", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/": 200,
      "/other": 500,
    });
    processes.push(backend);

    const server = await startOk200([
      "-b",
      String(backendPort),
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });
});

describe("ok200 - Multiple Paths (-p)", () => {
  test("multiple -p options all succeed returns OK", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/health": 200,
      "/ready": 200,
      "/": 404,
    });
    processes.push(backend);

    const server = await startOk200([
      "-b",
      String(backendPort),
      "-p",
      "/health",
      "-p",
      "/ready",
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("multiple -p options one fails returns Not OK", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/health": 200,
      "/ready": 503,
    });
    processes.push(backend);

    const server = await startOk200([
      "-b",
      String(backendPort),
      "-p",
      "/health",
      "-p",
      "/ready",
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(503);
    expect(await res.text()).toBe("Not OK");
  });

  test("multiple -p options all fail returns Not OK", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/health": 500,
      "/ready": 503,
    });
    processes.push(backend);

    const server = await startOk200([
      "-b",
      String(backendPort),
      "-p",
      "/health",
      "-p",
      "/ready",
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(503);
    expect(await res.text()).toBe("Not OK");
  });

  test("three paths all succeed returns OK", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/health": 200,
      "/ready": 200,
      "/live": 200,
    });
    processes.push(backend);

    const server = await startOk200([
      "-b",
      String(backendPort),
      "-p",
      "/health",
      "-p",
      "/ready",
      "-p",
      "/live",
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });
});
