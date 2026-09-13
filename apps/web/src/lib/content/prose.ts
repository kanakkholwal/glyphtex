/** Article typography: 16px/1.75 reading column, typography plugin colours pointed at tokens. */
export const proseClass = [
	"prose max-w-3xl",
	"[--tw-prose-body:var(--muted-foreground)] [--tw-prose-headings:var(--foreground)]",
	"[--tw-prose-lead:var(--muted-foreground)] [--tw-prose-links:var(--primary)]",
	"[--tw-prose-bold:var(--foreground)] [--tw-prose-counters:var(--primary)]",
	"[--tw-prose-bullets:var(--primary)] [--tw-prose-hr:var(--border)]",
	"[--tw-prose-quotes:var(--foreground)] [--tw-prose-quote-borders:var(--primary)]",
	"[--tw-prose-captions:var(--muted-foreground)] [--tw-prose-code:var(--foreground)]",
	"[--tw-prose-kbd:var(--foreground)] [--tw-prose-th-borders:var(--border)]",
	"[--tw-prose-td-borders:var(--border)]",
	"prose-headings:font-heading prose-headings:scroll-mt-28",
	"prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-heading-sm prose-h2:font-medium sm:prose-h2:text-heading",
	"prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-body-xl prose-h3:font-semibold",
	"prose-strong:font-semibold",
	"prose-a:font-medium prose-a:underline-offset-4 prose-a:decoration-1 hover:prose-a:decoration-2",
	"[&_a]:rounded-sm [&_a]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-ring",
	"prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
	"prose-pre:rounded-xl prose-pre:border prose-pre:border-border",
	"prose-blockquote:border-l-2 prose-blockquote:not-italic prose-blockquote:font-normal",
	"prose-table:text-body prose-td:align-top prose-img:rounded-xl"
].join(" ");
