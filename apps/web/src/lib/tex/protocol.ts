// The message contract between the page and the TeX worker.
//
// Kept in its own module so both sides import the same definitions and a change
// to one end cannot silently drift from the other.

import type { CompileStatus, Diagnostic } from '@glyphx/tex-engine';

/** `static/engine/manifest.json`, written by `scripts/sync-engine.mjs`. */
export interface EngineManifest {
	/** Content hash over every artifact; the persistent cache key. */
	version: string;
	totalBytes: number;
	files: Record<string, { bytes: number; hash: string }>;
}

export type WorkerRequest =
	/** Download, cache and boot the engine, reporting progress. */
	| { id: number; type: 'install' }
	/** Compile a document, booting the engine first if necessary. */
	| { id: number; type: 'compile'; source: string };

/**
 * A request before the client stamps it with an id.
 *
 * Distributive by construction: a plain `Omit<WorkerRequest, 'id'>` would
 * collapse the union into one object type and lose the discriminant, so
 * `{ type: 'compile', source }` would stop type-checking.
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
	  }
	| { id: number; type: 'error'; message: string };
