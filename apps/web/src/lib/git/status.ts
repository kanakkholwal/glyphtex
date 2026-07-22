import type { GitChange } from '@glyphtex/ui/application';

/** One `statusMatrix` row: `[path, head, workdir, stage]`. */
export type StatusRow = [string, number, number, number];

/** A status row to staged / unstaged changes. Each number names the newest version
 *  matched — 0 absent, 1 HEAD, 2 WORKDIR, 3 neither — so one row can yield both. */
export function changesFrom(row: StatusRow): GitChange[] {
	const [path, head, workdir, stage] = row;
	const out: GitChange[] = [];

	const stageMatchesHead = stage === 1 || (head === 0 && stage === 0);
	if (!stageMatchesHead) {
		out.push({
			path,
			status: head === 0 ? 'added' : stage === 0 ? 'deleted' : 'modified',
			staged: true
		});
	}

	const workdirMatchesStage =
		stage === 2 || (stage === 1 && workdir === 1) || (stage === 0 && workdir === 0);
	if (!workdirMatchesStage) {
		out.push({
			path,
			status: stage === 0 ? 'untracked' : workdir === 0 ? 'deleted' : 'modified',
			staged: false
		});
	}
	return out;
}
