import { getContext, hasContext, setContext } from "svelte";
import { breadcrumb, type BreadcrumbSize, type BreadcrumbVariant } from "./variants";

type Style = { variant: BreadcrumbVariant; size: BreadcrumbSize };

const STYLE = Symbol("breadcrumb-style");
export const setBreadcrumbStyle = (get: () => Style) => setContext(STYLE, get);
/** The root's variant and size, read lazily so a changed prop reaches every part. */
export const breadcrumbStyles = () =>
	breadcrumb(hasContext(STYLE) ? getContext<() => Style>(STYLE)() : {});
