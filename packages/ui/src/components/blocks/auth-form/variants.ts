import { tv, type VariantProps } from "tailwind-variants";

export const authForm = tv({
	slots: {
		root: "mx-auto w-full max-w-100 text-foreground",
		header: "grid gap-1.5 text-center",
		brand: "mb-3 flex justify-center",
		title: "text-balance font-semibold text-2xl tracking-tight",
		description: "text-pretty text-muted-foreground text-sm",
		// Both steps share one cell; the inactive one folds, so the card eases between heights.
		stage: "mt-6 grid",
		step: "col-start-1 row-start-1 grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-(--duration-collapse) ease-(--ease-out-quad) data-[active=true]:grid-rows-[1fr] data-[active=true]:opacity-100 motion-reduce:transition-none",
		stepInner: "min-h-0 overflow-hidden",
		form: "grid gap-4 p-px",
		providers: "grid gap-2",
		providerIcon: "size-4 [&>*]:size-4",
		// A closed fold also pulls in the form's gap, so nothing is left where it was.
		fold: "grid grid-rows-[1fr] self-start opacity-100 transition-[grid-template-rows,opacity,margin] duration-(--duration-collapse) ease-(--ease-out-quad) data-[open=false]:-mb-4 data-[open=false]:grid-rows-[0fr] data-[open=false]:opacity-0 motion-reduce:transition-none",
		foldInner: "grid min-h-0 gap-4 overflow-hidden px-px",
		error: "rounded-md bg-destructive/10 px-3 py-2 text-destructive-strong text-sm",
		codeIntro: "text-center text-muted-foreground text-sm",
		codeEmail: "font-medium text-foreground",
		codeField: "flex justify-center",
		resend: "text-center text-muted-foreground text-xs tabular-nums",
		footer: "mt-6 text-center text-muted-foreground text-sm",
		legal:
			"mt-4 text-pretty text-center text-muted-foreground text-xs [&_a]:underline [&_a]:underline-offset-2"
	},
	variants: {
		/** `card` frames the form on a bordered surface; `plain` sits on the page. */
		variant: {
			card: {
				root: "rounded-2xl bg-card p-6 shadow-sm @md:p-8"
			},
			plain: {}
		}
	},
	defaultVariants: { variant: "card" }
});

export type AuthFormVariant = NonNullable<VariantProps<typeof authForm>["variant"]>;
