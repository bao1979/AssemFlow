// Feature: sokoban-mvp-3-levels, EXAMPLE: check-level CLI 与 checkLevel 函数等价（AC 2.4 B）

import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const CWD = resolve(__dirname, "..");
const CLI = resolve(CWD, "scripts/check-level.ts");

/** 辅助：用 npx tsx 跑 CLI，返回 { status, stdout, stderr } */
function runCli(args: string[] = []) {
  const result = spawnSync("npx", ["tsx", CLI, ...args], {
    cwd: CWD,
    encoding: "utf-8",
    shell: true,
    timeout: 30_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe("check-level CLI（薄壳）", () => {
  it("level-push-1.txt（发表关·小）→ exit 0，stdout 含 通过", () => {
    const { status, stdout } = runCli(["src/levels/publishable/level-push-1.txt"]);
    expect(status).toBe(0);
    expect(stdout).toContain("通过");
  });

  it("level-push-big.txt（发表关·大）→ exit 0，stdout 含 通过", () => {
    const { status, stdout } = runCli(["src/levels/publishable/level-push-big.txt"]);
    expect(status).toBe(0);
    expect(stdout).toContain("通过");
  });

  it("level-walk-only.txt（0=0 特例·普通关）→ exit 0，stdout 含 通过", () => {
    const { status, stdout } = runCli(["src/levels/practice/level-walk-only.txt"]);
    expect(status).toBe(0);
    expect(stdout).toContain("通过");
  });

  it("level-malformed-leak.txt（畸形关）→ exit 1，stderr 含 [boundary-not-closed]", () => {
    const { status, stderr } = runCli(["src/levels/malformed/level-malformed-leak.txt"]);
    expect(status).toBe(1);
    expect(stderr).toContain("[boundary-not-closed]");
  });

  it("缺参数 → exit 2，stderr 含 用法", () => {
    const { status, stderr } = runCli([]);
    expect(status).toBe(2);
    expect(stderr).toContain("用法");
  });
});
