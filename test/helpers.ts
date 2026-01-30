import { afterEach } from "bun:test";
import { spawn, type Subprocess } from "bun";

export const OK200_PATH = "./ok200";
const BASE_PORT = 19000;

let portCounter = 0;
export function getPort(): number {
  return BASE_PORT + portCounter++;
}

export interface ServerProcess {
  proc: Subprocess | null;
  port: number;
  kill: () => void;
}

// Cleanup helper
export const processes: ServerProcess[] = [];

export function setupCleanup() {
  afterEach(async () => {
    for (const p of processes) {
      try {
        p.kill();
      } catch {}
    }
    processes.length = 0;
    await Bun.sleep(100);
  });
}

/**
 * Extract the port from ok200 arguments.
 * The port is the last positional argument (not preceded by -a, -b, or -p).
 * Options with values: -a ADDR, -b PORT, -p PATH
 * Options without values: -h
 */
export function extractPort(args: string[]): number {
  const optionsWithValue = new Set(["-a", "-b", "-p"]);
  let i = 0;
  let lastPositional: string | null = null;

  while (i < args.length) {
    const arg = args[i];
    if (optionsWithValue.has(arg)) {
      // Skip option and its value
      i += 2;
    } else if (arg.startsWith("-")) {
      // Option without value (like -h)
      i += 1;
    } else {
      // Positional argument (the port)
      lastPositional = arg;
      i += 1;
    }
  }

  return lastPositional ? parseInt(lastPositional, 10) : 8080;
}

export async function startOk200(args: string[] = []): Promise<ServerProcess> {
  const proc = spawn([OK200_PATH, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  await Bun.sleep(200);

  const port = extractPort(args);

  return {
    proc,
    port,
    kill: () => proc.kill(),
  };
}

export async function startOk200WithEnv(
  args: string[],
  env: Record<string, string>,
): Promise<ServerProcess> {
  const proc = spawn([OK200_PATH, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });

  await Bun.sleep(200);

  const port = extractPort(args);

  return {
    proc,
    port,
    kill: () => proc.kill(),
  };
}

export async function startBackend(
  port: number,
  statusCode: number = 200,
): Promise<ServerProcess> {
  const server = Bun.serve({
    port,
    fetch() {
      return new Response(statusCode === 200 ? "Backend OK" : "Backend Error", {
        status: statusCode,
      });
    },
  });

  return {
    proc: null,
    port,
    kill: () => server.stop(),
  };
}

export async function startBackendWithPath(
  port: number,
  pathHandlers: Record<string, number>,
): Promise<ServerProcess> {
  const server = Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);
      const status = pathHandlers[url.pathname] ?? 404;
      return new Response(status >= 200 && status < 300 ? "OK" : "Error", {
        status,
      });
    },
  });

  return {
    proc: null,
    port,
    kill: () => server.stop(),
  };
}
