import { getContext, setContext } from "svelte";

export interface StackContextValue {
	readonly stacked: boolean;
	readonly keys: string[];
	register: (key: string) => () => void;
}

const STACK = Symbol("chart-stack");

export function setStack(value: StackContextValue) {
	setContext(STACK, value);
}

export function useStack(): StackContextValue {
	return (
		getContext<StackContextValue | undefined>(STACK) ?? {
			stacked: false,
			keys: [],
			register: () => () => {}
		}
	);
}
