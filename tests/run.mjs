import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

// Use the installed TypeScript compiler and Node's test runner; no test framework dependency.
const compile = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.test.json"], { stdio: "inherit" });
if (compile.status !== 0) process.exit(compile.status ?? 1);
mkdirSync(".test-build", { recursive: true });
writeFileSync(".test-build/package.json", JSON.stringify({ type: "commonjs" }));
const tests = spawnSync(process.execPath, ["--test", "tests/eligibility.test.cjs", "tests/catalog.test.mjs", "tests/transcriptWorkflow.test.mjs"], { stdio: "inherit" });
process.exit(tests.status ?? 1);
