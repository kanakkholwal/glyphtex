import { tv, type VariantProps } from "tailwind-variants";

// A mirror under the textarea draws each mention's chip behind the real text, so the field
// stays a plain textarea for typing, selection and form submission.
export const mentionInput = tv({
	slots: {
		root: "relative w-full",
		frame: [
			"grid w-full rounded-lg border border-input bg-(--field) outline-none *:col-start-1 *:row-start-1",
			"transition-[border-color,box-shadow] duration-(--duration-fast) hover:border-border-strong",
			"has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-3 has-[textarea:focus-visible]:ring-ring/20",
		],
		mirror: [
			"pointer-events-none invisible overflow-hidden whitespace-pre-wrap break-words px-(--mi-px) py-(--mi-py) [&_[data-mention]]:visible",
			"min-h-[calc(var(--mi-min)*1lh+2*var(--mi-py))] max-h-[calc(var(--mi-max)*1lh+2*var(--mi-py))]",
		],
		chip: "rounded-sm bg-primary/12 text-transparent [box-decoration-break:clone]",
		area: "max-h-[calc(var(--mi-max)*1lh+2*var(--mi-py))] resize-none overflow-y-auto bg-transparent px-(--mi-px) py-(--mi-py) outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
		list: "absolute top-full z-50 mt-1 data-[side=top]:top-auto data-[side=top]:bottom-full data-[side=top]:mt-0 data-[side=top]:mb-1 max-h-64 w-72 overflow-y-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-(--overlay-shadow)",
		option:
			"flex cursor-default select-none items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm data-[active=true]:bg-accent",
		detail: "truncate text-muted-foreground text-xs",
		hash: "grid size-6 shrink-0 place-items-center rounded-md bg-muted font-semibold text-muted-foreground text-xs",
		empty: "px-2 py-1.5 text-muted-foreground text-sm",
	},
	variants: {
		size: {
			sm: { frame: "text-xs [--mi-px:--spacing(2.5)] [--mi-py:--spacing(1.5)]" },
			default: { frame: "text-sm [--mi-px:--spacing(3)] [--mi-py:--spacing(2)]" },
			lg: { frame: "text-base [--mi-px:--spacing(3.5)] [--mi-py:--spacing(2.5)]" },
		},
	},
	defaultVariants: { size: "default" },
});

export type MentionInputSize = NonNullable<VariantProps<typeof mentionInput>["size"]>;
