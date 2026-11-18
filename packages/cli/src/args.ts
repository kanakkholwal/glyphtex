export interface OptionSpec {
	type: "boolean" | "string";
	short?: string;
	description: string;
	/** Shown in help as `--name <hint>`. */
	hint?: string;
}

export type Specs = Record<string, OptionSpec>;

export interface Parsed {
	positionals: string[];
	flags: Record<string, string | boolean>;
	error?: string;
}

/** A small, strict parser: unknown flags are an error, so a typo never silently does nothing. */
export function parseArgs(argv: readonly string[], specs: Specs): Parsed {
	const flags: Record<string, string | boolean> = {};
	const positionals: string[] = [];
	const byShort = new Map(
		Object.entries(specs).flatMap(([n, s]) => (s.short ? [[s.short, n]] : []))
	);

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i] as string;
		if (arg === "--") {
			positionals.push(...argv.slice(i + 1));
			break;
		}
		if (!arg.startsWith("-") || arg === "-") {
			positionals.push(arg);
			continue;
		}
		let name: string | undefined;
		let inline: string | undefined;
		if (arg.startsWith("--")) {
			const eq = arg.indexOf("=");
			name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
			inline = eq === -1 ? undefined : arg.slice(eq + 1);
		} else {
			name = byShort.get(arg.slice(1));
			if (!name) return { positionals, flags, error: `Unknown option ${arg}.` };
		}
		const spec = specs[name];
		if (!spec) return { positionals, flags, error: `Unknown option --${name}.` };
		if (spec.type === "boolean") {
			if (inline !== undefined && inline !== "true" && inline !== "false") {
				return { positionals, flags, error: `--${name} takes no value.` };
			}
			flags[name] = inline !== "false";
		} else {
			const value = inline ?? argv[++i];
			if (value === undefined || (inline === undefined && value.startsWith("--"))) {
				return { positionals, flags, error: `--${name} needs a value.` };
			}
			flags[name] = value;
		}
	}
	return { positionals, flags };
}

export function formatOptions(specs: Specs): string {
	const rows = Object.entries(specs).map(([name, s]) => {
		const left = `${s.short ? `-${s.short}, ` : "    "}--${name}${s.type === "string" ? ` <${s.hint ?? "value"}>` : ""}`;
		return [left, s.description] as const;
	});
	const width = Math.max(...rows.map(([l]) => l.length), 0);
	return rows.map(([l, d]) => `  ${l.padEnd(width)}  ${d}`).join("\n");
}
