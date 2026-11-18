import pkg from "../../package.json" with { type: "json" };

export interface BuildInfo {
	version: string;
	runtime: "node" | "workers";
	/** Git commit, when the deployer provides one (GIT_COMMIT); null otherwise. */
	commit: string | null;
	/** When this build went live: DEPLOYED_AT, else the Workers version timestamp, else null. */
	deployedAt: string | null;
	/** Node: process start. Workers: first request of this isolate. */
	startedAt: string;
}

const startedAt = new Date().toISOString();

export function buildInfo(
	runtime: BuildInfo["runtime"],
	deploy: { gitCommit?: string; deploymentTime?: string },
	workersVersion?: { id?: string; timestamp?: string }
): BuildInfo {
	return {
		version: pkg.version,
		runtime,
		commit: deploy.gitCommit || null,
		deployedAt: deploy.deploymentTime || workersVersion?.timestamp || null,
		startedAt
	};
}
