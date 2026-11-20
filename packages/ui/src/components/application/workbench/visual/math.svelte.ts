import "katex/dist/katex.min.css";

type Katex = typeof import("katex").default;

let katex: Katex | undefined;
let loading: Promise<void> | undefined;

// Read inside a $derived so rendered maths replaces the source the moment the engine arrives.
const engine = $state({ ready: false });

/** Loads the maths renderer once; the visual editor works without it until it lands. */
export function loadMath(): Promise<void> {
	loading ??= import("katex").then((m) => {
		katex = m.default;
		engine.ready = true;
	});
	return loading;
}

/** HTML for a TeX fragment, or null while loading or when it cannot be rendered. */
export function renderMath(source: string, display = false): string | null {
	if (!engine.ready || !katex) return null;
	try {
		return katex.renderToString(source, {
			displayMode: display,
			throwOnError: true,
			strict: "ignore"
		});
	} catch {
		// Unsupported or half-typed TeX: the caller shows the source instead.
		return null;
	}
}
