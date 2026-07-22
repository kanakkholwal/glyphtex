import {
	createProject,
	deleteProject,
	renameProject,
	type StoredProject
} from '$lib/storage/projects';
import { rootFor } from './fs';
import { gitProvider } from './provider';

export { gitProvider, onWorkingTreeChanged } from './provider';
export { rootFor as gitRootFor, projectIdFrom } from './fs';
export {
	DEFAULT_CORS_PROXY,
	getCorsProxy,
	getIdentity,
	hasIdentity,
	setCorsProxy,
	setIdentity,
	type GitIdentity
} from './settings';

/** The repo folder name from a clone URL (last path segment, minus `.git`). */
export function repoNameFrom(url: string): string {
	const last = url.trim().replace(/\/+$/, '').split(/[/:]/).pop() ?? '';
	return last.replace(/\.git$/i, '') || 'Cloned repository';
}

/** Clone into a fresh document. The empty project exists first so the working tree
 *  has an id to live under; a failed clone takes it back out. */
export async function cloneToProject(url: string, name?: string): Promise<StoredProject> {
	const project = await createProject(name?.trim() || repoNameFrom(url), []);
	try {
		await gitProvider.clone(url, rootFor(project.id));
	} catch (error) {
		await deleteProject(project.id).catch(() => {
			/* the clone failure is the one worth reporting */
		});
		throw error;
	}
	return name?.trim() ? project : renameProject(project.id, repoNameFrom(url));
}
