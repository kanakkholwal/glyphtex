import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { projectFile, projectVersion } from "../src/db/schema.ts";
import { sha256Hex } from "../src/lib/crypto.ts";
import { fileRepository } from "../src/repositories/files.ts";
import { VERSION_LIMITS, versionService } from "../src/services/versions.ts";
import { startPg } from "./pg.ts";

type Pg = Awaited<ReturnType<typeof startPg>>;
let pg: Pg;
let svc: ReturnType<typeof versionService>;

before(async () => {
	pg = await startPg();
	svc = versionService(pg.deps());
});
after(() => pg.close());

const contentOf = async (projectId: string, path: string) =>
	(await fileRepository(pg.db).get(projectId, path))?.content;

async function seeded() {
	const owner = await pg.user("Ada");
	const p = await pg.project(owner.id);
	await pg.textFile(p.id, "main.tex", "v1 main");
	await pg.textFile(p.id, "refs.bib", "v1 refs");
	return { owner, p };
}

describe("named versions", () => {
	test("saves every text file and lists newest first with the author", async () => {
		const { owner, p } = await seeded();
		const { id } = await svc.create(p.access(), owner.id, "  First draft  ");
		const list = await svc.list(p.access("viewer"));
		assert.equal(list.length, 1);
		assert.deepEqual(
			[list[0]?.name, list[0]?.kind, list[0]?.fileCount, list[0]?.createdByName],
			["First draft", "named", 2, "Ada"]
		);
		const files = await svc.files(p.access("viewer"), id);
		assert.deepEqual(
			files.map((f) => f.path),
			["main.tex", "refs.bib"]
		);
		assert.equal(await svc.readFile(p.access("viewer"), id, "main.tex"), "v1 main");
	});

	test("a blank name is refused", async () => {
		const { owner, p } = await seeded();
		await assert.rejects(svc.create(p.access(), owner.id, "   "), /name/i);
	});

	test("binary files are not part of a version", async () => {
		const { owner, p } = await seeded();
		await pg.db.insert(projectFile).values({
			projectId: p.id,
			path: "logo.png",
			kind: "binary",
			blobKey: "k",
			contentType: "image/png",
			size: 10,
			sha256: "x",
			version: 1
		});
		const { id } = await svc.create(p.access(), owner.id, "with image");
		assert.deepEqual(
			(await svc.files(p.access(), id)).map((f) => f.path),
			["main.tex", "refs.bib"]
		);
	});

	test("a version belongs to its project only", async () => {
		const { owner, p } = await seeded();
		const other = await pg.project(owner.id);
		const { id } = await svc.create(p.access(), owner.id, "mine");
		await assert.rejects(svc.files(other.access(), id), /not found/i);
		await assert.rejects(svc.readFile(other.access(), id, "main.tex"), /not found/i);
		await assert.rejects(svc.remove(other.access(), id), /not found/i);
	});

	test("rename and delete", async () => {
		const { owner, p } = await seeded();
		const { id } = await svc.create(p.access(), owner.id, "old");
		await svc.rename(p.access(), id, "new");
		assert.equal((await svc.list(p.access()))[0]?.name, "new");
		await svc.remove(p.access(), id);
		assert.equal((await svc.list(p.access())).length, 0);
	});

	test("a project keeps a bounded number of named versions", async () => {
		const { owner, p } = await seeded();
		for (let i = 0; i < VERSION_LIMITS.named; i++) await svc.create(p.access(), owner.id, `v${i}`);
		await assert.rejects(svc.create(p.access(), owner.id, "one too many"), /named versions/);
	});
});

describe("restore", () => {
	test("puts files back, keeps newer files, and saves a safety copy first", async () => {
		const { owner, p } = await seeded();
		const { id } = await svc.create(p.access(), owner.id, "good");

		// Work continues: one file edited, one deleted, one added.
		await pg.db
			.update(projectFile)
			.set({ content: "v2 main", sha256: await sha256Hex("v2 main"), version: 2 })
			.where(and(eq(projectFile.projectId, p.id), eq(projectFile.path, "main.tex")));
		await pg.textFile(p.id, "extra.tex", "new file");

		const result = await svc.restore(p.access(), owner.id, id);
		assert.equal(result.restored, 1);
		assert.equal(await contentOf(p.id, "main.tex"), "v1 main");
		assert.equal(await contentOf(p.id, "extra.tex"), "new file");

		const list = await svc.list(p.access());
		const safety = list.find((v) => v.kind === "auto");
		assert.ok(safety?.name?.includes("Before restoring"));
		// The safety copy holds the edited text, so the restore can itself be undone.
		assert.equal(await svc.readFile(p.access(), safety?.id ?? "", "main.tex"), "v2 main");
	});

	test("recreates a file that was deleted since", async () => {
		const { owner, p } = await seeded();
		const { id } = await svc.create(p.access(), owner.id, "has refs");
		await fileRepository(pg.db).deleteIfVersion(p.id, "refs.bib", 1);
		const result = await svc.restore(p.access(), owner.id, id);
		assert.ok(result.restored >= 1);
		assert.equal(await contentOf(p.id, "refs.bib"), "v1 refs");
	});

	test("restoring an unchanged project rewrites nothing", async () => {
		const { owner, p } = await seeded();
		const { id } = await svc.create(p.access(), owner.id, "same");
		assert.equal((await svc.restore(p.access(), owner.id, id)).restored, 0);
	});

	test("automatic copies are trimmed to the newest few", async () => {
		const { owner, p } = await seeded();
		const { id } = await svc.create(p.access(), owner.id, "base");
		for (let i = 0; i < VERSION_LIMITS.auto + 3; i++) await svc.restore(p.access(), owner.id, id);
		const autos = await pg.db
			.select()
			.from(projectVersion)
			.where(eq(projectVersion.projectId, p.id));
		assert.equal(autos.filter((v) => v.kind === "auto").length, VERSION_LIMITS.auto);
		assert.equal(autos.filter((v) => v.kind === "named").length, 1);
	});
});
