// Runs every test file. `node --test test/*.test.mjs` depends on the shell expanding the glob, which
// cmd.exe does not do and Node 20 does not do for itself, so the files are listed here.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "test");
const files = readdirSync(dir)
	.filter((name) => name.endsWith(".test.mjs"))
	.map((name) => join(dir, name));

const run = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(run.status ?? 1);
