import type { CompileStatus, Diagnostic, PackDefinition } from 'glyphtex-engine';

/** `static/engine/manifest.json`, written by `scripts/sync-engine.mjs`. */
export interface EngineManifest {
	/** Content hash over every artifact; the persistent cache key. */
	version: string;
	totalBytes: number;
	files: Record<string, { bytes: number; hash: string }>;
}

/** One file for the engine's in-memory filesystem. `data` carries images. */
export type CompileFile = { name: string; text?: string; data?: Uint8Array };

export type WorkerRequest =
	/** Download, cache and boot the engine, reporting progress. */
	| { id: number; type: 'install' }
	/**
	 * Compile `entry` with `files` mounted, booting the engine first if necessary.
	 * `docId` identifies the document: when it changes the worker unmounts the
	 * previous one, so its files and `.aux` cannot leak into this compile.
	 */
	| { id: number; type: 'compile'; files: CompileFile[]; entry: string; docId: string }
	/** Download the named packs and load them into the running engine. */
	| { id: number; type: 'installPacks'; packIds: string[] };

/**
 * A request before the client stamps it with an id.
 * Distributive: plain `Omit` would collapse the union and lose the discriminant.
 */
export type UnsentRequest<T = WorkerRequest> = T extends { id: number } ? Omit<T, 'id'> : never;

export type WorkerResponse =
	| { id: number; type: 'progress'; loaded: number; total: number; label: string }
	| { id: number; type: 'installed' }
	| {
			id: number;
			type: 'compiled';
			pdf?: Uint8Array;
			log: string;
			diagnostics: Diagnostic[];
			status: CompileStatus;
			message?: string;
			/**
			 * Packs supplying the files this compile could not find; resolved in the
			 * worker, where the pack index lives. `unsupportedFiles` is what no pack covers.
			 */
			missingPacks?: PackDefinition[];
			unsupportedFiles?: string[];
	  }
	| { id: number; type: 'packsInstalled' }
	| { id: number; type: 'error'; message: string };
