import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const result = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.catalog.json"], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status ?? 1);
mkdirSync(".catalog-build", { recursive: true });
writeFileSync(".catalog-build/package.json", JSON.stringify({ type: "commonjs" }));
await import("./cli.mjs");
