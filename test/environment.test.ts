import { describe, test, expect } from "bun:test";
import { spawn } from "bun";
import {
  OK200_PATH,
  getPort,
  processes,
  setupCleanup,
  startOk200WithEnv,
  startBackendWithPath,
} from "./helpers";

setupCleanup();

describe("ok200 - CC_HEALTH_CHECK_PATH_X Environment Variables", () => {
  test("CC_HEALTH_CHECK_PATH_0 sets backend path", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/env-health": 200,
      "/": 404,
    });
    processes.push(backend);

    const server = await startOk200WithEnv(
      ["-b", String(backendPort), String(frontendPort)],
      { CC_HEALTH_CHECK_PATH_0: "/env-health" },
    );
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("multiple CC_HEALTH_CHECK_PATH_X variables", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/health": 200,
      "/ready": 200,
      "/": 404,
    });
    processes.push(backend);

    const server = await startOk200WithEnv(
      ["-b", String(backendPort), String(frontendPort)],
      {
        CC_HEALTH_CHECK_PATH_0: "/health",
        CC_HEALTH_CHECK_PATH_1: "/ready",
      },
    );
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("fails if any CC_HEALTH_CHECK_PATH_X path fails", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/health": 200,
      "/ready": 500,
    });
    processes.push(backend);

    const server = await startOk200WithEnv(
      ["-b", String(backendPort), String(frontendPort)],
      {
        CC_HEALTH_CHECK_PATH_0: "/health",
        CC_HEALTH_CHECK_PATH_1: "/ready",
      },
    );
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(503);
    expect(await res.text()).toBe("Not OK");
  });

  test("-p option overrides CC_HEALTH_CHECK_PATH_X", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/from-option": 200,
      "/from-env": 500,
    });
    processes.push(backend);

    const server = await startOk200WithEnv(
      ["-b", String(backendPort), "-p", "/from-option", String(frontendPort)],
      { CC_HEALTH_CHECK_PATH_0: "/from-env" },
    );
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("multiple -p options completely override all CC_HEALTH_CHECK_PATH_X", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/cli1": 200,
      "/cli2": 200,
      "/env1": 500,
      "/env2": 500,
    });
    processes.push(backend);

    const server = await startOk200WithEnv(
      [
        "-b",
        String(backendPort),
        "-p",
        "/cli1",
        "-p",
        "/cli2",
        String(frontendPort),
      ],
      {
        CC_HEALTH_CHECK_PATH_0: "/env1",
        CC_HEALTH_CHECK_PATH_1: "/env2",
      },
    );
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    // If env paths were used, this would return 503
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("empty CC_HEALTH_CHECK_PATH_0 is ignored", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackendWithPath(backendPort, {
      "/": 200,
    });
    processes.push(backend);

    const server = await startOk200WithEnv(
      ["-b", String(backendPort), String(frontendPort)],
      { CC_HEALTH_CHECK_PATH_0: "" },
    );
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("-h shows CC_HEALTH_CHECK_PATH in help", async () => {
    const proc = spawn([OK200_PATH, "-h"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(output).toContain("CC_HEALTH_CHECK_PATH_0");
  });
});
