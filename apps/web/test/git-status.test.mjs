import assert from 'node:assert/strict';
import test from 'node:test';

import { changesFrom } from './.build/git/status.mjs';

const of = (head, workdir, stage) => changesFrom(['main.tex', head, workdir, stage]);

test('an unmodified file is not a change', () => {
	assert.deepEqual(of(1, 1, 1), []);
});

test('the plain working-tree states map to one unstaged change each', () => {
	assert.deepEqual(of(1, 2, 1), [{ path: 'main.tex', status: 'modified', staged: false }]);
	assert.deepEqual(of(1, 0, 1), [{ path: 'main.tex', status: 'deleted', staged: false }]);
	assert.deepEqual(of(0, 2, 0), [{ path: 'main.tex', status: 'untracked', staged: false }]);
});

test('the plain index states map to one staged change each', () => {
	assert.deepEqual(of(1, 2, 2), [{ path: 'main.tex', status: 'modified', staged: true }]);
	assert.deepEqual(of(0, 2, 2), [{ path: 'main.tex', status: 'added', staged: true }]);
	assert.deepEqual(of(1, 0, 0), [{ path: 'main.tex', status: 'deleted', staged: true }]);
});

test('staged then edited again shows on both sides, as git status does', () => {
	assert.deepEqual(of(1, 2, 3), [
		{ path: 'main.tex', status: 'modified', staged: true },
		{ path: 'main.tex', status: 'modified', staged: false }
	]);
	assert.deepEqual(of(0, 2, 3), [
		{ path: 'main.tex', status: 'added', staged: true },
		{ path: 'main.tex', status: 'modified', staged: false }
	]);
});

test('deleted from the index but still on disk is a staged delete plus an untracked file', () => {
	assert.deepEqual(of(1, 1, 0), [
		{ path: 'main.tex', status: 'deleted', staged: true },
		{ path: 'main.tex', status: 'untracked', staged: false }
	]);
});

test('added to the index then removed from disk is a staged add plus an unstaged delete', () => {
	assert.deepEqual(of(0, 0, 3), [
		{ path: 'main.tex', status: 'added', staged: true },
		{ path: 'main.tex', status: 'deleted', staged: false }
	]);
});

test('every reachable row yields at most one change per side', () => {
	for (const head of [0, 1]) {
		for (const workdir of [0, 1, 2]) {
			for (const stage of [0, 1, 2, 3]) {
				const changes = of(head, workdir, stage);
				assert.ok(changes.filter((c) => c.staged).length <= 1);
				assert.ok(changes.filter((c) => !c.staged).length <= 1);
			}
		}
	}
});
