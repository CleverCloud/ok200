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

describe("ok200 - CLI Arguments", () => {
  test("-h flag shows help and exits", async () => {
    const proc = spawn([OK200_PATH, "-h"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(0);
    expect(output).toContain("Usage:");
    expect(output).toContain("-b PORT");
    expect(output).toContain("-p PATH");
    expect(output).toContain("-a ADDR");
    expect(output).toContain("-h");
    expect(output).toContain("CC_HEALTH_CHECK_PATH");
  });

  test("invalid port shows error", async () => {
    const proc = spawn([OK200_PATH, "invalid"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid port");
  });

  test("port 0 is rejected", async () => {
    const proc = spawn([OK200_PATH, "0"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid port");
  });

  test("port 65536 is rejected", async () => {
    const proc = spawn([OK200_PATH, "65536"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid port");
  });

  test("negative port is rejected", async () => {
    const proc = spawn([OK200_PATH, "-1"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
  });

  test("invalid backend port shows error", async () => {
    const proc = spawn([OK200_PATH, "-b", "invalid"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid backend port");
  });

  test("unknown option shows error", async () => {
    const proc = spawn([OK200_PATH, "-x"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
  });
});

describe("ok200 - Bind Address Option (-a)", () => {
  test("-a 127.0.0.1 binds to localhost only", async () => {
    const port = getPort();
    const server = await startOk200(["-a", "127.0.0.1", String(port)]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${port}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("-a works with -b backend option", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();

    const backend = await startBackend(backendPort, 200);
    processes.push(backend);

    const server = await startOk200([
      "-a",
      "127.0.0.1",
      "-b",
      String(backendPort),
      String(frontendPort),
    ]);
    processes.push(server);

    const res = await fetch(`http://127.0.0.1:${frontendPort}/`);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("default bind address is 0.0.0.0", async () => {
    const port = getPort();
    const proc = spawn([OK200_PATH, String(port)], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await Bun.sleep(200);
    proc.kill();

    const stdout = await new Response(proc.stdout).text();
    expect(stdout).toContain("Server running on 0.0.0.0:");
  });
});

describe("ok200 - Port Validation Edge Cases", () => {
  test("port 1 is accepted by argument parser (privileged port)", async () => {
    // Port 1 is valid syntax but requires root to bind
    // We only verify the parser accepts it, not that binding succeeds
    const proc = spawn([OK200_PATH, "1"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await Bun.sleep(100);
    proc.kill();

    const stderr = await new Response(proc.stderr).text();
    // Should not show "Invalid port" - binding failure is different from parsing failure
    expect(stderr).not.toContain("Invalid port");
  });

  test("port 65535 is valid (maximum)", async () => {
    const proc = spawn([OK200_PATH, "65535"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await Bun.sleep(200);
    proc.kill();

    const stderr = await new Response(proc.stderr).text();
    expect(stderr).not.toContain("Invalid port");
  });

  test("port with trailing characters is rejected", async () => {
    const proc = spawn([OK200_PATH, "8080abc"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    expect(exitCode).toBe(1);
  });

  test("very large port number is rejected", async () => {
    const proc = spawn([OK200_PATH, "999999999999"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Invalid port");
  });

  test("empty port string is rejected", async () => {
    const proc = spawn([OK200_PATH, ""], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    expect(exitCode).toBe(1);
  });
});

describe("ok200 - Startup Messages", () => {
  test("shows startup message with port and address", async () => {
    const port = getPort();
    const proc = spawn([OK200_PATH, String(port)], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await Bun.sleep(200);
    proc.kill();

    const stdout = await new Response(proc.stdout).text();
    expect(stdout).toContain(`Server running on 0.0.0.0:${port}`);
  });

  test("shows startup message with backend info", async () => {
    const backendPort = getPort();
    const frontendPort = getPort();
    const proc = spawn(
      [
        OK200_PATH,
        "-a",
        "127.0.0.1",
        "-b",
        String(backendPort),
        String(frontendPort),
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    await Bun.sleep(200);
    proc.kill();

    const stdout = await new Response(proc.stdout).text();
    expect(stdout).toContain("Server running on 127.0.0.1:");
    expect(stdout).toContain(`checking backend on port ${backendPort}`);
  });

  test("fails when port is already in use", async () => {
    const port = getPort();

    const server1 = await startOk200([String(port)]);
    processes.push(server1);

    const proc = spawn([OK200_PATH, String(port)], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Failed to start server");
  });
});

describe("ok200 - MAX_PATHS Limit", () => {
  test("warns when exceeding MAX_PATHS (5)", async () => {
    const proc = spawn(
      [
        OK200_PATH,
        "-b",
        "3000",
        "-p",
        "/p1",
        "-p",
        "/p2",
        "-p",
        "/p3",
        "-p",
        "/p4",
        "-p",
        "/p5",
        "-p",
        "/p6",
        "8080",
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    await Bun.sleep(200);
    proc.kill();

    const stderr = await new Response(proc.stderr).text();
    expect(stderr).toContain("Maximum number of paths");
    expect(stderr).toContain("/p6");
  });

  test("accepts exactly 5 paths without warning", async () => {
    const proc = spawn(
      [
        OK200_PATH,
        "-b",
        "3000",
        "-p",
        "/p1",
        "-p",
        "/p2",
        "-p",
        "/p3",
        "-p",
        "/p4",
        "-p",
        "/p5",
        "8080",
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    await Bun.sleep(200);
    proc.kill();

    const stderr = await new Response(proc.stderr).text();
    expect(stderr).not.toContain("Maximum number of paths");
  });
});

describe("ok200 - Invalid Bind Address", () => {
  test("-a with invalid IP address fails", async () => {
    const proc = spawn([OK200_PATH, "-a", "999.999.999.999", "8080"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Failed to start server");
  });

  test("-a with malformed address fails", async () => {
    const proc = spawn([OK200_PATH, "-a", "not-an-ip", "8080"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    expect(exitCode).toBe(1);
  });
});

describe("ok200 - IPv6 Bind Address", () => {
  test("-a with IPv6 address is parsed correctly", async () => {
    // Test that IPv6 addresses are accepted by the argument parser
    // Binding may fail if IPv6 is not available on the system
    const port = getPort();
    const proc = spawn([OK200_PATH, "-a", "::1", String(port)], {
      stdout: "pipe",
      stderr: "pipe",
    });

    await Bun.sleep(300);
    proc.kill();

    const stderr = await new Response(proc.stderr).text();
    // Should not show "Invalid" - IPv6 syntax should be accepted
    // May show "Failed to start server" if IPv6 not available, which is OK
    expect(stderr).not.toContain("Invalid");
  });
});
