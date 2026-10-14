#!/usr/bin/env node
/**
 * Ensure a Next dev server is running on PORT (default 3000), started detached.
 *   node scripts/dev.mjs [port]
 * Log: /tmp/next-<port>.log. Prints "ready" once the page responds.
 */
import { spawn } from "child_process";
import fs from "fs";

const port = process.argv[2] || process.env.PORT || "3000";
const url = `http://localhost:${port}/`;
const up = async () => {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    return r.status < 500;
  } catch {
    return false;
  }
};

if (!(await up())) {
  const log = fs.openSync(`/tmp/next-${port}.log`, "a");
  const child = spawn("npx", ["next", "dev", "-p", port], { cwd: process.cwd(), detached: true, stdio: ["ignore", log, log] });
  child.unref();
  const start = Date.now();
  while (Date.now() - start < 240000) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await up()) break;
  }
}
console.log((await up()) ? `ready ${url}` : `NOT READY — see /tmp/next-${port}.log`);
