import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
	type CompileRequest,
	defaultPacks,
	EnginePoisonedError,
	type PackDefinition,
	type PackIndex,
	parsePackIndex,
	resolveMissing,
	TexEngine,
	unpackTarGz
} from "glyphtex-engine";
import type { LoadedFile } from "./project.js";
import type { Ui } from "./ui.js";

const asset = (specifier: string) => readFile(fileURLToPath(import.meta.resolve(specifier)));

type Compiled = ReturnType<TexEngine["compile"]>;

/**
 * The WebAssembly engine, kept loaded between builds so `watch` pays the start-up cost once.
 * It needs nothing installed beyond this package.
 */
export class WasmSession {
	readonly packsLoaded = new Set<string>();
	#engine: TexEngine;
	#index: PackIndex;
	#known = new Set<string>();

	private constructor(engine: TexEngine, index: PackIndex) {
		this.#engine = engine;
		this.#index = index;
	}

	static async open(ui: Ui): Promise<WasmSession> {
		const task = ui.task("Starting the TeX engine");
		try {
			const { engine, index } = await WasmSession.#boot(task);
			task.succeed("TeX engine ready");
			return new WasmSession(engine, index);
		} catch (error) {
			task.fail("Could not start the TeX engine");
			throw error;
		}
	}

	static async #boot(task: { update(text: string): void }) {
		task.update("Loading the engine (3.6 MB)");
		const engine = await TexEngine.load(await asset("glyphtex-engine/wasm"));
		task.update("Unpacking the TeX bundle (16 MB)");
		engine.addFiles(await unpackTarGz(await asset("glyphtex-engine/bundle")));
		const index = parsePackIndex(
			JSON.parse((await asset("glyphtex-engine/packs/index.json")).toString("utf8"))
		);
		return { engine, index };
	}

	/** Replaces the project's files in the engine: new and changed ones are added, vanished ones removed. */
	sync(files: readonly LoadedFile[]) {
		const next = new Set<string>();
		for (const f of files) {
			this.#engine.addFile(f.path, f.data);
			next.add(f.path);
		}
		for (const path of this.#known) if (!next.has(path)) this.#engine.removeFile(path);
		this.#known = next;
	}

	/** Which optional packs a set of package names needs, found through the pack index. */
	packsFor(names: readonly string[]): PackDefinition[] {
		const wanted: string[] = [];
		for (const name of names) {
			for (const ext of ["sty", "cls"]) {
				if (this.#index.provides[`${name}.${ext}`]) wanted.push(`${name}.${ext}`);
			}
		}
		return resolveMissing(this.#index, wanted, this.#installed()).packs;
	}

	#installed() {
		return [...this.packsLoaded].map((id) => ({
			id,
			hash: this.#index.packs.find((p) => p.id === id)?.hash ?? ""
		}));
	}

	async loadPacks(packs: readonly PackDefinition[], ui: Ui): Promise<void> {
		const todo = packs.filter((p) => !this.packsLoaded.has(p.id));
		if (todo.length === 0) return;
		const total = todo.reduce((n, p) => n + p.bytes, 0);
		const bar = ui.progress(
			`Loading ${todo.length} package set${todo.length === 1 ? "" : "s"}`,
			total
		);
		let done = 0;
		for (const pack of todo) {
			this.#engine.addFiles(
				await unpackTarGz(await asset(`glyphtex-engine/packs/pack-${pack.id}.tar.gz`))
			);
			this.packsLoaded.add(pack.id);
			done += pack.bytes;
			bar.tick(done);
		}
		bar.done(`Loaded ${todo.map((p) => p.id).join(", ")}`);
	}

	/** Packs that would fix these missing files, and the files nothing here can provide. */
	resolve(missing: readonly string[]) {
		return resolveMissing(this.#index, missing, this.#installed());
	}

	get defaultPackIds(): string[] {
		return defaultPacks(this.#index).map((p) => p.id);
	}

	compile(request: CompileRequest): Compiled {
		this.#engine.clearOutputs();
		try {
			return this.#engine.compile(request);
		} catch (error) {
			if (error instanceof EnginePoisonedError) this.#poisoned = true;
			throw error;
		}
	}

	#poisoned = false;
	get poisoned() {
		return this.#poisoned;
	}

	pdf(): Uint8Array | undefined {
		return this.#engine.pdf();
	}

	log(): string | undefined {
		return this.#engine.log();
	}
}
