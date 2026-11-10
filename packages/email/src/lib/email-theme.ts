/** Theme tokens resolved to hex: email clients support neither CSS variables nor oklch. */
export const emailColors = {
	background: "#ffffff",
	foreground: "#0d0d0e",
	card: "#f6f7f7",
	"card-foreground": "#0d0d0e",
	muted: "#efeff1",
	"muted-foreground": "#626366",
	border: "#ececec",
	"border-strong": "#dddddd",
	primary: "#026fd7",
	"primary-foreground": "#fcfcfc",
	destructive: "#d73337",
	"destructive-foreground": "#fcfcfc",
	success: "#17c964",
	warning: "#f5a524",
	info: "#0072e2",
	"chart-1": "#2a78d6",
	"chart-2": "#eb6834",
	"chart-3": "#1baf7a",
	"chart-4": "#eda100",
	"chart-5": "#e87ba4",
	"primary-soft": "#e6f1fb",
	"info-soft": "#e5f1fc",
	"success-soft": "#e8faef",
	"warning-soft": "#fef6e9",
	"destructive-soft": "#fbebeb",
	"background-dark": "#0f0f10",
	"foreground-dark": "#f1f2f2",
	"card-dark": "#18181a",
	"card-foreground-dark": "#f1f2f2",
	"muted-dark": "#252628",
	"muted-foreground-dark": "#919295",
	"border-dark": "#202021",
	"border-strong-dark": "#2c2c2d",
	"primary-dark": "#59a0f9",
	"primary-foreground-dark": "#151515",
	"destructive-dark": "#d73337",
	"destructive-foreground-dark": "#fcfcfc",
	"success-dark": "#17c964",
	"warning-dark": "#f7b750",
	"info-dark": "#0072e2",
	"chart-1-dark": "#3987e5",
	"chart-2-dark": "#d95926",
	"chart-3-dark": "#199e70",
	"chart-4-dark": "#c98500",
	"chart-5-dark": "#d55181",
	"primary-soft-dark": "#1c293a",
	"info-soft-dark": "#0c2136",
	"success-soft-dark": "#10311f",
	"warning-soft-dark": "#392e1c",
	"destructive-soft-dark": "#331617"
} as const;

/** Web fonts load in few inboxes, so the stack falls back to each platform's system face. */
export const emailFonts = {
	sans: ["Inter", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
	mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
} as const;

/** Tailwind theme for React Email's `<Tailwind config>` and Better Svelte Email's
 * `new Renderer({ tailwindConfig })`; `dark:` classes pair with the `-dark` colours. */
export const emailTailwindConfig = {
	theme: {
		// px, not Tailwind's rem default: several inboxes ignore rem in media queries.
		screens: { sm: "480px" },
		extend: {
			colors: emailColors,
			fontFamily: emailFonts,
			borderRadius: { DEFAULT: "10px", sm: "6px", lg: "14px" }
		}
	}
};
