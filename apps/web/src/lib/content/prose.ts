/** Article typography: a 16px reading column, typography plugin colours pointed at tokens. */
export const proseClass = [
	"prose max-w-none text-base",
	"[--tw-prose-body:var(--muted-foreground)] [--tw-prose-headings:var(--foreground)]",
	"[--tw-prose-lead:var(--muted-foreground)] [--tw-prose-links:var(--primary)]",
	"[--tw-prose-bold:var(--foreground)] [--tw-prose-counters:var(--muted-foreground)]",
	"[--tw-prose-bullets:var(--muted-foreground)] [--tw-prose-hr:var(--border)]",
	"[--tw-prose-quotes:var(--foreground)] [--tw-prose-quote-borders:var(--border)]",
	"[--tw-prose-captions:var(--muted-foreground)] [--tw-prose-code:var(--foreground)]",
	"[--tw-prose-kbd:var(--foreground)] [--tw-prose-th-borders:var(--border)]",
	"[--tw-prose-td-borders:var(--border)]",
	"prose-headings:scroll-mt-24",
	"prose-h1:pixel prose-h1:text-4xl",
	"prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-2xl prose-h2:font-medium",
	"prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-lg prose-h3:font-medium",
	"prose-strong:font-semibold",
	"prose-a:font-medium prose-a:underline-offset-4 prose-a:decoration-1 hover:prose-a:decoration-2",
	"[&_a]:rounded-sm [&_a]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-ring",
	"prose-code:font-mono prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
	"[&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:bg-card [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:text-sm",
	// Shiki paints <pre> with github-dark inline colours, so only dark mode can take bg-card and keep contrast.
	"prose-pre:rounded-xl prose-pre:border prose-pre:border-border prose-pre:font-mono prose-pre:text-sm dark:prose-pre:bg-card!",
	"prose-blockquote:border-l-2 prose-blockquote:not-italic prose-blockquote:font-normal",
	"prose-table:text-sm prose-td:align-top prose-img:rounded-xl"
].join(" ");
