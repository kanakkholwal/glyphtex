import type { Adapters } from "./adapters/types.ts";
import type { Auth, AuthSession, AuthUser } from "./auth/auth.ts";
import type { Config } from "./config.ts";
import type { Db } from "./db/client.ts";
import type { Logger } from "./lib/logger.ts";
import type { ProjectAccess } from "./rbac/authorize.ts";

/** Everything a request needs, built by the runtime entry (Workers or Node) and injected. */
export interface Deps {
	config: Config;
	db: Db;
	adapters: Adapters;
	auth: Auth;
	logger: Logger;
}

export interface AppEnv {
	Variables: {
		deps: Deps;
		log: Logger;
		requestId: string;
		user: AuthUser | null;
		session: AuthSession | null;
		access: ProjectAccess;
	};
}
