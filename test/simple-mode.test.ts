import { describe, test, expect } from "bun:test";
import {
  getPort,
  processes,
  setupCleanup,
  startOk200,
} from "./helpers";

setupCleanup();

describe("ok200 - Simple Mode", () => {
  test("responds with 200 OK on root path", async () => {
    const port = getPort();
    const server = await startOk200([String(port)]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${port}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("responds with 200 OK on any path", async () => {
    const port = getPort();
    const server = await startOk200([String(port)]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${port}/some/random/path`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("responds with correct Content-Type", async () => {
    const port = getPort();
    const server = await startOk200([String(port)]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${port}/`);

    expect(res.headers.get("Content-Type")).toBe("text/plain;charset=utf-8");
  });

  test("responds with correct Content-Length", async () => {
    const port = getPort();
    const server = await startOk200([String(port)]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${port}/`);

    expect(res.headers.get("Content-Length")).toBe("2");
  });

  test("includes Date header in RFC 7231 format", async () => {
    const port = getPort();
    const server = await startOk200([String(port)]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${port}/`);
    const dateHeader = res.headers.get("Date");

    expect(dateHeader).toBeTruthy();
    expect(dateHeader).toMatch(
      /^\w{3}, \d{2} \w{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/,
    );
  });

  test("includes Connection: close header", async () => {
    const port = getPort();
    const server = await startOk200([String(port)]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${port}/`);

    expect(res.headers.get("Connection")).toBe("close");
  });

  test("uses default port 8080 when not specified", async () => {
    const server = await startOk200([]);
    processes.push(server);

    const res = await fetch("http://127.0.0.1:8080/");

    expect(res.status).toBe(200);
  });
});
