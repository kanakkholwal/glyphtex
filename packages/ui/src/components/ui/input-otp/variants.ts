import { tv, type VariantProps } from "tailwind-variants";

/** Separate filled slots; one ring glides to the active slot, a typed digit rises in. */
export const inputOtp = tv({
	slots: {
		root: "group/otp relative flex items-center gap-2 has-disabled:opacity-50",
		input: "disabled:cursor-not-allowed",
		group: "flex items-center gap-2",
		slot: [
			"relative flex items-center justify-center overflow-hidden border font-medium tabular-nums outline-none",
			"transition-[border-color,background-color,color,opacity,scale] duration-(--duration-base) ease-[var(--ease-smooth)] motion-reduce:transition-none",
			"aria-invalid:border-destructive",
			// Verifying light; it only shows while `status` is "verifying".
			"after:pointer-events-none after:absolute after:inset-0 after:-translate-x-[120%] after:bg-linear-to-r after:from-transparent after:via-foreground/[0.07] after:to-transparent after:opacity-0 after:content-['']"
		],
		value: "otp-value",
		caret: "pointer-events-none absolute inset-0 flex items-center justify-center",
		caretLine: "otp-caret h-4 w-px bg-foreground",
		separator:
			"flex items-center text-muted-foreground transition-opacity duration-(--duration-base) [&_svg]:size-4",
		// One ring for the whole field, moved to whichever slot is active.
		ring: [
			"pointer-events-none absolute top-0 left-0 z-10 border border-ring opacity-0 ring-3 ring-ring/20",
			"transition-[translate,width,height,opacity,border-color] duration-(--duration-base) ease-[var(--ease-ui-out)] motion-reduce:transition-none",
			"data-[show]:opacity-100"
		],
		verified: [
			"pointer-events-none absolute top-1/2 left-1/2 z-20 inline-flex h-9 -translate-x-1/2 -translate-y-1/2 scale-90 items-center gap-1.5 whitespace-nowrap rounded-full bg-card px-3.5 font-medium text-foreground text-sm opacity-0 shadow-xs",
			"transition-[opacity,scale] duration-(--duration-slow) ease-[var(--ease-ui-out)] motion-reduce:transition-none"
		],
		check:
			"size-4 fill-none stroke-success [stroke-dasharray:1] [stroke-dashoffset:1] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.4] transition-[stroke-dashoffset] delay-300 duration-(--duration-slow) ease-[var(--ease-ui-out)] motion-reduce:transition-none"
	},
	variants: {
		/** `default` is a bordered field per slot; `soft` sits empty slots on a muted fill. */
		variant: {
			default: {
				slot: "border-input bg-(--field)"
			},
			soft: {
				slot: "border-transparent bg-muted data-[filled]:border-border data-[filled]:bg-card"
			}
		},
		size: {
			// Square slots on the control ladder, so a code field lines up with the button beside it.
			xs: { slot: "size-6 rounded-sm text-xs", root: "gap-1", group: "gap-1" },
			sm: { slot: "size-8 rounded-md text-sm", root: "gap-1.5", group: "gap-1.5" },
			default: { slot: "size-9 rounded-lg text-base" },
			lg: { slot: "size-10 rounded-lg text-lg" },
			xl: { slot: "size-12 rounded-xl text-xl", root: "gap-2.5", group: "gap-2.5" }
		},
		invalid: {
			true: {
				slot: "border-destructive",
				ring: "border-destructive ring-destructive/20"
			},
			false: {}
		},
		/** Plays once each time `invalid` turns on. */
		invalidMotion: { shake: {}, pulse: {}, none: {} },
		/** Controlled: the check is running, or the code was accepted. */
		status: {
			idle: {},
			verifying: {
				slot: "text-muted-foreground after:animate-[otp-shimmer_1.3s_ease-in-out_infinite] after:opacity-100 after:[animation-delay:var(--otp-delay-shimmer,0ms)] motion-reduce:after:animate-none",
				ring: "data-[show]:opacity-0"
			},
			success: {
				slot: "scale-60 opacity-0",
				separator: "opacity-0",
				ring: "data-[show]:opacity-0",
				verified: "scale-100 opacity-100 delay-150",
				check: "[stroke-dashoffset:0]"
			}
		}
	},
	compoundVariants: [
		{
			invalid: true,
			invalidMotion: "shake",
			class: {
				root: "animate-[otp-shake_400ms_var(--ease-ui-out)] motion-reduce:animate-none"
			}
		},
		{
			invalid: true,
			invalidMotion: "pulse",
			class: {
				slot: "animate-[otp-pulse_360ms_var(--ease-ui-out)] motion-reduce:animate-none"
			}
		}
	],
	defaultVariants: {
		variant: "default",
		size: "default",
		invalid: false,
		invalidMotion: "shake",
		status: "idle"
	}
});

/** The lines under the field: the error message and the resend countdown. */
export const inputOtpMeta = tv({
	slots: {
		fold: "grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-(--duration-collapse) ease-[var(--ease-ui-out)] data-[open]:grid-rows-[1fr] data-[open]:opacity-100 motion-reduce:transition-none",
		clip: "min-h-0 overflow-hidden",
		message:
			"m-0 flex items-center gap-1.5 pt-2.5 text-foreground text-sm [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:fill-none [&_svg]:stroke-destructive [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-width:2]",
		resend:
			"m-0 text-muted-foreground text-sm tabular-nums transition-opacity duration-(--duration-base) data-[hidden]:invisible data-[hidden]:opacity-0",
		swap: "inline-block transition-[opacity,translate] duration-(--duration-base) ease-[var(--ease-ui-out)] starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none",
		wait: "text-foreground",
		action:
			"relative cursor-pointer border-0 bg-transparent p-0 font-medium text-primary underline-offset-4 outline-none before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
	}
});

export type InputOtpVariant = NonNullable<VariantProps<typeof inputOtp>["variant"]>;
export type InputOtpSize = NonNullable<VariantProps<typeof inputOtp>["size"]>;
export type InputOtpInvalidMotion = NonNullable<VariantProps<typeof inputOtp>["invalidMotion"]>;
export type InputOtpStatus = NonNullable<VariantProps<typeof inputOtp>["status"]>;

/** 25 reads "0:25", 125 "2:05". */
export const formatCountdown = (seconds: number) => {
	const s = Math.max(0, Math.ceil(seconds));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export const INPUT_OTP_ICONS = {
	check: "M5.5 12.5l4 4L18.5 8",
	alert: "M12 8v4.5M12 16h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
} as const;
