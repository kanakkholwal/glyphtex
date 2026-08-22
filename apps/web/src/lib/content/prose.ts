/**
 * Article typography. Overrides land on tokens rather than Tailwind's greys so
 * light and dark stay in step with the rest of the app.
 */
export const proseClass = [
	"prose prose-neutral max-w-none dark:prose-invert",
	"prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground",
	"prose-h2:mt-14 prose-h2:mb-4 prose-h2:text-2xl prose-h2:scroll-mt-28",
	"prose-h3:mt-10 prose-h3:mb-3 prose-h3:text-lg prose-h3:scroll-mt-28",
	"prose-p:text-[1.0625rem] prose-p:leading-[1.75] prose-p:text-muted-foreground",
	"prose-li:text-[1.0625rem] prose-li:leading-[1.7] prose-li:text-muted-foreground",
	"prose-strong:text-foreground prose-strong:font-semibold",
	"prose-a:text-foreground prose-a:underline prose-a:decoration-hairline prose-a:underline-offset-[3px] hover:prose-a:decoration-foreground",
	"prose-code:text-foreground prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
	"prose-pre:rounded-xl prose-pre:border prose-pre:border-hairline prose-pre:bg-[#0d1117]",
	"prose-blockquote:border-l-2 prose-blockquote:border-brand prose-blockquote:not-italic prose-blockquote:font-normal prose-blockquote:text-foreground",
	"prose-table:text-[0.9375rem] prose-th:text-foreground prose-td:text-muted-foreground prose-td:align-top",
	"prose-img:rounded-xl prose-hr:border-hairline"
].join(" ");
