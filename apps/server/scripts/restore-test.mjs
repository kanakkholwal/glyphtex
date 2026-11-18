// Proves a backup restores: migrate a scratch Postgres, dump it, restore into a second database,
// and compare per-table row counts. Needs Docker. Run: pnpm restore-test
import { execFileSync, spawnSync } from "node:child_process";

const name = `glyphtex-restore-${process.pid}`;
const port = process.env.RESTORE_TEST_PORT ?? "55432";
const sh = (cmd, args, opts = {}) =>
	execFileSync(cmd, args, { stdio: "pipe", encoding: "utf8", ...opts });
const psql = (db, sql) =>
	sh("docker", ["exec", name, "psql", "-U", "postgres", "-d", db, "-At", "-c", sql]).trim();

function counts(db) {
	const tables = psql(
		db,
		"select tablename from pg_tables where schemaname='public' order by 1"
	).split("\n");
	return Object.fromEntries(
		tables.filter(Boolean).map((t) => [t, Number(psql(db, `select count(*) from "${t}"`))])
	);
}

try {
	sh("docker", [
		"run",
		"-d",
		"--rm",
		"--name",
		name,
		"-e",
		"POSTGRES_PASSWORD=pw",
		"-p",
		`${port}:5432`,
		"postgres:17"
	]);
	for (let i = 0; i < 30; i++) {
		if (spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres"]).status === 0) break;
		await new Promise((r) => setTimeout(r, 1000));
	}
	psql("postgres", "create database source");
	psql("postgres", "create database restored");
	execFileSync("node", ["--env-file-if-exists=.env", "src/db/migrate.ts"], {
		stdio: "inherit",
		env: { ...process.env, DATABASE_URL: `postgres://postgres:pw@localhost:${port}/source` }
	});
	psql(
		"source",
		"insert into \"user\" (id, name, email, email_verified, created_at, updated_at) values ('u1','Restore Test','restore@example.test',true,now(),now())"
	);
	sh("docker", [
		"exec",
		name,
		"pg_dump",
		"-U",
		"postgres",
		"-Fc",
		"-f",
		"/tmp/backup.dump",
		"source"
	]);
	sh("docker", [
		"exec",
		name,
		"pg_restore",
		"-U",
		"postgres",
		"--no-owner",
		"-d",
		"restored",
		"/tmp/backup.dump"
	]);
	const a = counts("source");
	const b = counts("restored");
	const diff = Object.keys(a).filter((t) => a[t] !== b[t]);
	if (diff.length || a.user !== 1)
		throw new Error(`Row counts differ after restore: ${diff.join(", ") || "user"}`);
	console.log(`Restore verified: ${Object.keys(a).length} tables match, user row present.`);
} finally {
	spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
}
