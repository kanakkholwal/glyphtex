import { readFiles, getProject } from "$lib/storage/projects";
import { writeZip } from "$lib/storage/zip";
import { cloud } from "./api";

/** Copies a browser-only document to the server; the local copy stays where it is. */
export async function uploadLocalProject(localId: string): Promise<string> {
	const [project, files] = await Promise.all([getProject(localId), readFiles(localId)]);
	if (!project) throw new Error("That document no longer exists.");
	const encoder = new TextEncoder();
	const zip = await writeZip(
		files.map((f) => ({ path: f.path, data: f.data ?? encoder.encode(f.text ?? "") }))
	);
	const result = await cloud.projects.import(project.name, zip);
	// The server guesses a root on import; keep the one the user settled locally.
	if (result.project.mainFile !== project.entry && files.some((f) => f.path === project.entry)) {
		await cloud.projects.update(result.project.id, { mainFile: project.entry });
	}
	return result.project.id;
}
