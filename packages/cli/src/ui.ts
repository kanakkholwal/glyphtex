/**
 * Terminal output. Everything visual goes to stderr so stdout stays clean for `--json` and for
 * piping. Animation only happens on a real terminal; logs and CI get plain lines.
 */
import { stderr } from "node:process";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export interface UiOptions {
	/** Print nothing but errors (for `--quiet` and `--json`). */
	quiet?: boolean;
	/** Force colour and animation on or off; default is auto-detect. */
	color?: boolean;
	animate?: boolean;
}

const ansi = (open: number, close: number) => (on: boolean) => (text: string) =>
	on ? `\u001b[${open}m${text}\u001b[${close}m` : text;

export function detectColor(env: NodeJS.ProcessEnv = process.env, isTty = stderr.isTTY): boolean {
	if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return false;
	if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "0") return true;
	return Boolean(isTty) && env.TERM !== "dumb";
}

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${Math.round(ms)} ms`;
	return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

/** A progress bar line, e.g. `████████░░░░░░░░ 52%  8.4 / 16.1 MB  3.1 MB/s  eta 2 s`. */
export function renderBar(opts: {
	done: number;
	total: number | undefined;
	width?: number;
	bytesPerSecond?: number;
	color?: (s: string) => string;
}): string {
	const width = opts.width ?? 24;
	const paint = opts.color ?? ((s: string) => s);
	if (!opts.total) return `${formatBytes(opts.done)}`;
	const ratio = Math.min(1, opts.done / opts.total);
	const filled = Math.round(ratio * width);
	const bar = `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
	const speed =
		opts.bytesPerSecond && opts.bytesPerSecond > 0
			? `  ${formatBytes(opts.bytesPerSecond)}/s  eta ${formatDuration(((opts.total - opts.done) / opts.bytesPerSecond) * 1000)}`
			: "";
	return `${paint(bar)} ${String(Math.round(ratio * 100)).padStart(3)}%  ${formatBytes(opts.done)} / ${formatBytes(opts.total)}${speed}`;
}

export class Ui {
	readonly color: boolean;
	readonly animate: boolean;
	readonly quiet: boolean;
	readonly bold: (s: string) => string;
	readonly dim: (s: string) => string;
	readonly red: (s: string) => string;
	readonly green: (s: string) => string;
	readonly yellow: (s: string) => string;
	readonly cyan: (s: string) => string;
	#timer: ReturnType<typeof setInterval> | undefined;
	#frame = 0;
	#line = "";

	constructor(options: UiOptions = {}) {
		this.color = options.color ?? detectColor();
		this.animate = options.animate ?? Boolean(stderr.isTTY && !process.env.CI);
		this.quiet = options.quiet ?? false;
		this.bold = ansi(1, 22)(this.color);
		this.dim = ansi(2, 22)(this.color);
		this.red = ansi(31, 39)(this.color);
		this.green = ansi(32, 39)(this.color);
		this.yellow = ansi(33, 39)(this.color);
		this.cyan = ansi(36, 39)(this.color);
	}

	#write(text: string) {
		stderr.write(text);
	}

	#clear() {
		if (this.animate && this.#line) this.#write("\r\u001b[2K");
	}

	/** A finished line. Clears any running spinner first so output never interleaves. */
	line(text = "", force = false) {
		if (this.quiet && !force) return;
		this.#clear();
		this.#write(`${text}\n`);
		if (this.#line) this.#draw();
	}

	success(text: string) {
		this.line(`${this.green("✔")} ${text}`);
	}
	warn(text: string) {
		this.line(`${this.yellow("!")} ${text}`);
	}
	error(text: string) {
		this.line(`${this.red("✖")} ${text}`, true);
	}
	info(text: string) {
		this.line(`${this.cyan("›")} ${text}`);
	}

	#draw() {
		if (!this.animate || !this.#line) return;
		const frame = FRAMES[this.#frame % FRAMES.length] ?? "⠋";
		this.#write(`\r\u001b[2K${this.cyan(frame)} ${this.#line}`);
	}

	/** A spinner task. Resolves to a handle that updates its label and ends in success or failure. */
	task(label: string) {
		const started = Date.now();
		this.#line = label;
		if (this.quiet) {
			return { update() {}, succeed() {}, fail() {} };
		}
		if (this.animate) {
			this.#draw();
			this.#timer = setInterval(() => {
				this.#frame++;
				this.#draw();
			}, 80);
		} else {
			this.#write(`${label}…\n`);
		}
		const end = (symbol: string, text: string) => {
			clearInterval(this.#timer);
			this.#timer = undefined;
			this.#clear();
			this.#line = "";
			this.#write(`${symbol} ${text} ${this.dim(formatDuration(Date.now() - started))}\n`);
		};
		return {
			update: (text: string) => {
				this.#line = text;
				if (this.animate) this.#draw();
			},
			succeed: (text = label) => end(this.green("✔"), text),
			fail: (text = label) => end(this.red("✖"), text)
		};
	}

	/** A byte progress bar for downloads. `tick` takes the running total. */
	progress(label: string, total?: number) {
		const started = Date.now();
		let last = 0;
		const draw = (done: number) => {
			const seconds = (Date.now() - started) / 1000;
			const bar = renderBar({
				done,
				total,
				bytesPerSecond: seconds > 0.3 ? done / seconds : undefined,
				color: this.cyan
			});
			this.#line = `${label}  ${bar}`;
			if (this.animate) this.#draw();
			else if (done - last > (total ?? 0) / 4 || done === total) {
				last = done;
				this.#write(`${label}  ${bar}\n`);
			}
		};
		if (this.quiet) return { tick() {}, done() {}, fail() {} };
		if (this.animate) draw(0);
		return {
			tick: draw,
			done: (text = label) => {
				this.#clear();
				this.#line = "";
				this.#write(
					`${this.green("✔")} ${text} ${this.dim(formatDuration(Date.now() - started))}\n`
				);
			},
			fail: (text = label) => {
				this.#clear();
				this.#line = "";
				this.#write(`${this.red("✖")} ${text}\n`);
			}
		};
	}
}
