import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { reviewService } from "../src/services/review.ts";
import { startPg } from "./pg.ts";

type Pg = Awaited<ReturnType<typeof startPg>>;
let pg: Pg;
let svc: ReturnType<typeof reviewService>;

before(async () => {
	pg = await startPg();
	svc = reviewService(pg.deps());
});
after(() => pg.close());

const rejects = (promise: Promise<unknown>, pattern: RegExp) => assert.rejects(promise, pattern);

describe("comments", () => {
	test("a thread: first comment, reply, listing order and author names", async () => {
		const owner = await pg.user("Ada");
		const guest = await pg.user("Grace");
		const p = await pg.project(owner.id);
		const first = await svc.createComment(p.access("owner"), owner.id, {
			path: "main.tex",
			body: "Why this claim?",
			quote: "clearly",
			from: 10,
			to: 17
		});
		await svc.createComment(p.access("commenter"), guest.id, {
			path: "ignored.tex",
			body: "Added a citation.",
			parentId: first?.id
		});
		const list = await svc.listComments(p.access("viewer"), "main.tex");
		assert.deepEqual(
			list.map((c) => [c.authorName, c.body, c.parentId === null]),
			[
				["Ada", "Why this claim?", true],
				["Grace", "Added a citation.", false]
			]
		);
		// A reply takes the thread's file and carries no anchor of its own.
		assert.equal(list[1]?.path, "main.tex");
		assert.equal(list[1]?.quote, null);
		assert.equal(list[0]?.quote, "clearly");
	});

	test("replies must target a first comment in the same project", async () => {
		const owner = await pg.user("Ada");
		const a = await pg.project(owner.id);
		const b = await pg.project(owner.id);
		const root = await svc.createComment(a.access(), owner.id, { path: "a.tex", body: "root" });
		const reply = await svc.createComment(a.access(), owner.id, {
			path: "a.tex",
			body: "reply",
			parentId: root?.id
		});
		await rejects(
			svc.createComment(a.access(), owner.id, { path: "a.tex", body: "x", parentId: reply?.id }),
			/first comment/
		);
		await rejects(
			svc.createComment(b.access(), owner.id, { path: "a.tex", body: "x", parentId: root?.id }),
			/not found/i
		);
	});

	test("only the author edits; resolving needs the author or write access", async () => {
		const owner = await pg.user("Ada");
		const other = await pg.user("Grace");
		const p = await pg.project(owner.id);
		const c = await svc.createComment(p.access("commenter"), other.id, {
			path: "m.tex",
			body: "typo"
		});
		await rejects(svc.editComment(p.access("owner"), owner.id, c?.id ?? "", "x"), /author/i);
		assert.equal(
			(await svc.editComment(p.access("commenter"), other.id, c?.id ?? "", "typo!"))?.body,
			"typo!"
		);
		const stranger = await pg.user("Linus");
		await rejects(
			svc.setResolved(p.access("commenter"), stranger.id, c?.id ?? "", true),
			/permission/i
		);
		const resolved = await svc.setResolved(p.access("editor"), owner.id, c?.id ?? "", true);
		assert.ok(resolved?.resolvedAt);
		const reopened = await svc.setResolved(p.access("commenter"), other.id, c?.id ?? "", false);
		assert.equal(reopened?.resolvedAt, null);
	});

	test("deleting a first comment removes its replies; non-authors need owner rights", async () => {
		const owner = await pg.user("Ada");
		const other = await pg.user("Grace");
		const p = await pg.project(owner.id);
		const root = await svc.createComment(p.access("commenter"), other.id, {
			path: "m.tex",
			body: "r"
		});
		await svc.createComment(p.access("owner"), owner.id, {
			path: "m.tex",
			body: "reply",
			parentId: root?.id
		});
		await rejects(svc.deleteComment(p.access("editor"), owner.id, root?.id ?? ""), /permission/i);
		await svc.deleteComment(p.access("owner"), owner.id, root?.id ?? "");
		assert.equal((await svc.listComments(p.access("owner"))).length, 0);
	});

	test("comments are scoped to their project", async () => {
		const owner = await pg.user("Ada");
		const a = await pg.project(owner.id);
		const b = await pg.project(owner.id);
		const c = await svc.createComment(a.access(), owner.id, { path: "a.tex", body: "mine" });
		assert.equal((await svc.listComments(b.access())).length, 0);
		await rejects(svc.deleteComment(b.access(), owner.id, c?.id ?? ""), /not found/i);
	});
});

describe("suggestions", () => {
	const input = { path: "m.tex", quote: "teh", replacement: "the", from: 4, to: 7 };

	test("proposed, listed pending, accepted once", async () => {
		const owner = await pg.user("Ada");
		const author = await pg.user("Grace");
		const p = await pg.project(owner.id);
		const s = await svc.createSuggestion(p.access("commenter"), author.id, input);
		assert.equal((await svc.listSuggestions(p.access("viewer"), { status: "pending" })).length, 1);
		const done = await svc.decide(p.access("editor"), owner.id, s?.id ?? "", "accepted");
		assert.equal(done?.status, "accepted");
		assert.equal(done?.decidedBy, owner.id);
		await rejects(
			svc.decide(p.access("editor"), owner.id, s?.id ?? "", "rejected"),
			/already decided/
		);
		assert.equal((await svc.listSuggestions(p.access("viewer"), { status: "pending" })).length, 0);
	});

	test("a no-op or backwards range is refused", async () => {
		const owner = await pg.user("Ada");
		const p = await pg.project(owner.id);
		await rejects(
			svc.createSuggestion(p.access(), owner.id, { ...input, replacement: "teh" }),
			/Nothing would change/
		);
		await rejects(
			svc.createSuggestion(p.access(), owner.id, { ...input, from: 9, to: 2 }),
			/backwards/
		);
	});

	test("only the author withdraws, and only while pending", async () => {
		const owner = await pg.user("Ada");
		const author = await pg.user("Grace");
		const p = await pg.project(owner.id);
		const s = await svc.createSuggestion(p.access("commenter"), author.id, input);
		await rejects(svc.withdraw(p.access("owner"), owner.id, s?.id ?? ""), /author/i);
		await svc.decide(p.access("editor"), owner.id, s?.id ?? "", "rejected");
		await rejects(svc.withdraw(p.access("commenter"), author.id, s?.id ?? ""), /pending/);
		const s2 = await svc.createSuggestion(p.access("commenter"), author.id, input);
		await svc.withdraw(p.access("commenter"), author.id, s2?.id ?? "");
		assert.equal((await svc.listSuggestions(p.access("owner"), {})).length, 1);
	});

	test("filters by file path", async () => {
		const owner = await pg.user("Ada");
		const p = await pg.project(owner.id);
		await svc.createSuggestion(p.access(), owner.id, input);
		await svc.createSuggestion(p.access(), owner.id, { ...input, path: "other.tex" });
		assert.equal((await svc.listSuggestions(p.access(), { path: "other.tex" })).length, 1);
		assert.equal((await svc.listSuggestions(p.access(), {})).length, 2);
	});
});
