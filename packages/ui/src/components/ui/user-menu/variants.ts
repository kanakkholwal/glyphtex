import { tv, type VariantProps } from "tailwind-variants";

// The dot morphs between statuses: a bar slides in for busy and a hole opens for away.
export const userMenu = tv({
	slots: {
		trigger:
			"group/um items-center gap-2 rounded-full p-0.5 pr-0.5 transition-colors duration-(--duration-fast) hover:bg-muted data-[popup-open]:bg-muted data-[state=open]:bg-muted",
		face: "relative inline-grid flex-none",
		dot: [
			"absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background transition-colors duration-(--duration-base)",
			"before:absolute before:inset-x-[2px] before:top-1/2 before:h-[2px] before:-translate-y-1/2 before:scale-x-0 before:rounded-full before:bg-background before:transition-transform before:duration-(--duration-base)",
			"after:absolute after:inset-[2.5px] after:scale-0 after:rounded-full after:bg-background after:transition-transform after:duration-(--duration-base)",
			"data-[presence=available]:bg-success data-[presence=busy]:bg-destructive data-[presence=busy]:before:scale-x-100 data-[presence=away]:bg-warning data-[presence=away]:after:scale-100",
			"motion-reduce:transition-none motion-reduce:before:transition-none motion-reduce:after:transition-none"
		],
		name: "hidden max-w-40 truncate font-medium text-sm sm:inline",
		chevron:
			"hidden size-3.5 text-muted-foreground transition-[rotate] duration-(--duration-fast) group-data-[popup-open]/um:rotate-180 group-data-[state=open]/um:rotate-180 sm:block",
		content: "w-max min-w-52 max-w-64",
		header: "flex items-center gap-3 px-2.5 py-2 font-normal text-foreground text-sm",
		identity: "grid min-w-0 flex-1",
		headerName: "flex min-w-0 items-center gap-1.5 font-medium",
		email: "truncate text-muted-foreground text-xs",
		icon: "size-4 text-muted-foreground",
		value: "ml-auto text-muted-foreground text-xs"
	},
	variants: {
		size: {
			sm: { face: "[&>[data-slot=avatar]]:size-7" },
			default: { face: "[&>[data-slot=avatar]]:size-8" }
		}
	},
	defaultVariants: { size: "default" }
});

export type UserMenuSize = NonNullable<VariantProps<typeof userMenu>["size"]>;
