import { getContext, setContext } from "svelte";
import type { showcaseCard } from "./variants";

type ShowcaseCardStyles = ReturnType<typeof showcaseCard>;
type ShowcaseCardContext = () => ShowcaseCardStyles;
const KEY = Symbol("showcase-card");

export const setShowcaseCard = (styles: ShowcaseCardContext) => setContext(KEY, styles);
export const useShowcaseCard = () => getContext<ShowcaseCardContext>(KEY);
