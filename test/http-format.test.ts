import { describe, test, expect } from "bun:test";
import { getPort, processes, setupCleanup, startOk200 } from "./helpers";

setupCleanup();

describe("ok200 - HTTP Response Format", () => {
  test("Content-Length has no padding spaces", async () => {
    const port = getPort();
    const server = await startOk200([String(port)]);
    processes.push(server);

    // Use raw TCP to check exact response format
    await Bun.connect({
      hostname: "127.0.0.1",
      port,
      socket: {
        data(socket, data) {
          const response = data.toString();
          // Mongoose bug: Content-Length might have padding spaces
          // Our fix should produce "Content-Length: 2\r\n" not "Content-Length: 2          \r\n"
          const contentLengthMatch = response.match(
            /Content-Length: (\d+)\s*\r\n/,
          );
          expect(contentLengthMatch).toBeTruthy();
          expect(contentLengthMatch![0]).toBe("Content-Length: 2\r\n");
          socket.end();
        },
        open(socket) {
          socket.write("GET / HTTP/1.1\r\nHost: localhost\r\n\r\n");
        },
        close() {},
        error() {},
      },
    });

    await Bun.sleep(200);
  });

  test("503 response has correct format without padding", async () => {
    const port = getPort();
    const server = await startOk200(["-b", "59999", String(port)]);
    processes.push(server);

    await Bun.connect({
      hostname: "127.0.0.1",
      port,
      socket: {
        data(socket, data) {
          const response = data.toString();
          expect(response).toContain("HTTP/1.1 503");
          const contentLengthMatch = response.match(
            /Content-Length: (\d+)\s*\r\n/,
          );
          expect(contentLengthMatch).toBeTruthy();
          expect(contentLengthMatch![0]).toBe("Content-Length: 6\r\n");
          expect(response).toContain("Not OK");
          socket.end();
        },
        open(socket) {
          socket.write("GET / HTTP/1.1\r\nHost: localhost\r\n\r\n");
        },
        close() {},
        error() {},
      },
    });

    await Bun.sleep(200);
  });
});
