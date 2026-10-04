/** Pure hex/HSV/HSL/RGB conversion, shared byte-for-byte by both color-picker ports. */

export function isValidHex(hex: string): boolean {
	return /^#[0-9a-fA-F]{6}$/.test(hex);
}

function channels(hex: string): [number, number, number] | null {
	const h = hex.replace("#", "");
	if (h.length !== 6) return null;
	return [
		Number.parseInt(h.slice(0, 2), 16) / 255,
		Number.parseInt(h.slice(2, 4), 16) / 255,
		Number.parseInt(h.slice(4, 6), 16) / 255
	];
}

function hueOf(r: number, g: number, b: number, max: number, delta: number): number {
	if (delta === 0) return 0;
	const hue =
		max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
	return hue * 60 < 0 ? hue * 60 + 360 : hue * 60;
}

/** Wheel position for a hue, then the two mixing channels either side of it. */
function wheel(hue: number, c: number, x: number): [number, number, number] {
	if (hue < 60) return [c, x, 0];
	if (hue < 120) return [x, c, 0];
	if (hue < 180) return [0, c, x];
	if (hue < 240) return [0, x, c];
	if (hue < 300) return [x, 0, c];
	return [c, 0, x];
}

function toHex(r: number, g: number, b: number, m: number): string {
	const part = (n: number) =>
		Math.round((n + m) * 255)
			.toString(16)
			.padStart(2, "0");
	return `#${part(r)}${part(g)}${part(b)}`;
}

export function hexToHsv(hex: string): [number, number, number] {
	const rgb = channels(hex);
	if (!rgb) return [0, 0, 100];
	const [r, g, b] = rgb;
	const max = Math.max(r, g, b);
	const delta = max - Math.min(r, g, b);
	return [
		Math.round(hueOf(r, g, b, max, delta)),
		max === 0 ? 0 : Math.round((delta / max) * 100),
		Math.round(max * 100)
	];
}

export function hsvToHex(hue: number, sat: number, val: number): string {
	const v = val / 100;
	const c = v * (sat / 100);
	const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
	const [r, g, b] = wheel(hue, c, x);
	return toHex(r, g, b, v - c);
}

export function hexToHsl(hex: string): [number, number, number] {
	const rgb = channels(hex);
	if (!rgb) return [0, 0, 100];
	const [r, g, b] = rgb;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	const l = (max + min) / 2;
	const sat = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
	return [Math.round(hueOf(r, g, b, max, delta)), Math.round(sat * 100), Math.round(l * 100)];
}

export function hslToHex(hue: number, sat: number, light: number): string {
	const l = light / 100;
	const c = (1 - Math.abs(2 * l - 1)) * (sat / 100);
	const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
	const [r, g, b] = wheel(hue, c, x);
	return toHex(r, g, b, l - c / 2);
}

export function hexToRgb(hex: string): [number, number, number] {
	const rgb = channels(hex);
	if (!rgb) return [255, 255, 255];
	return [Math.round(rgb[0] * 255), Math.round(rgb[1] * 255), Math.round(rgb[2] * 255)];
}

export function rgbToHex(red: number, green: number, blue: number): string {
	const part = (value: number) =>
		Math.round(Math.max(0, Math.min(255, value)))
			.toString(16)
			.padStart(2, "0");
	return `#${part(red)}${part(green)}${part(blue)}`;
}

/** Reads "#abc", "abc", "#aabbcc" or "aabbcc" as lowercase "#rrggbb"; null when it is not hex. */
export function parseHex(raw: string): string | null {
	const hex = raw.trim().replace(/^#/, "").toLowerCase();
	if (/^[0-9a-f]{3}$/.test(hex)) return `#${[...hex].map((c) => c + c).join("")}`;
	return /^[0-9a-f]{6}$/.test(hex) ? `#${hex}` : null;
}

/** Steps a hex on its 24-bit value, clamped to black and white. */
export function stepHex(hex: string, delta: number): string {
	const next = Number.parseInt(hex.slice(1), 16) + delta;
	return `#${Math.min(0xffffff, Math.max(0, next)).toString(16).padStart(6, "0")}`;
}

/** The step a key applies to a hex field: arrows by 1, Page keys by 16. */
export function hexKeyStep(key: string): number | null {
	if (key === "ArrowUp") return 1;
	if (key === "ArrowDown") return -1;
	if (key === "PageUp") return 16;
	if (key === "PageDown") return -16;
	return null;
}
