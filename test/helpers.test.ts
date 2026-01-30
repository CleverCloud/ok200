import { describe, test, expect } from "bun:test";
import { extractPort } from "./helpers";

describe("extractPort", () => {
  test("extracts port as only argument", () => {
    expect(extractPort(["8080"])).toBe(8080);
  });

  test("returns default 8080 when no arguments", () => {
    expect(extractPort([])).toBe(8080);
  });

  test("extracts port after -a option", () => {
    expect(extractPort(["-a", "127.0.0.1", "9000"])).toBe(9000);
  });

  test("extracts port after -b option", () => {
    expect(extractPort(["-b", "3000", "9000"])).toBe(9000);
  });

  test("extracts port after -p option", () => {
    expect(extractPort(["-p", "/health", "9000"])).toBe(9000);
  });

  test("extracts port with multiple -p options", () => {
    expect(extractPort(["-p", "/health", "-p", "/ready", "9000"])).toBe(9000);
  });

  test("extracts port with all options combined", () => {
    expect(
      extractPort(["-a", "127.0.0.1", "-b", "3000", "-p", "/health", "9000"]),
    ).toBe(9000);
  });

  test("extracts port when options are after port", () => {
    // ok200 uses getopt, so options can come before positional args
    // but our helper should still find the positional arg
    expect(extractPort(["9000", "-a", "127.0.0.1"])).toBe(9000);
  });

  test("does not confuse -b value with port", () => {
    expect(extractPort(["-b", "3000", "8080"])).toBe(8080);
  });

  test("does not confuse -a value with port when it looks like a number", () => {
    // Edge case: -a could have a value that starts with digits (unlikely but possible)
    expect(extractPort(["-a", "0.0.0.0", "8080"])).toBe(8080);
  });

  test("handles -h option without value", () => {
    expect(extractPort(["-h"])).toBe(8080);
  });

  test("extracts port with -h and other options", () => {
    expect(extractPort(["-h", "-a", "127.0.0.1", "9000"])).toBe(9000);
  });

  test("handles complex argument order", () => {
    expect(
      extractPort([
        "-b",
        "4242",
        "-a",
        "127.0.0.1",
        "-p",
        "/health",
        "-p",
        "/ready",
        "8888",
      ]),
    ).toBe(8888);
  });
});
