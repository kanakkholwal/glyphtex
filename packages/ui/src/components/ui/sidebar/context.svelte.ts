import { IsMobile } from "../../../lib/hooks/is-mobile.svelte.js";
import { getContext, setContext } from "svelte";
import { SIDEBAR_KEYBOARD_SHORTCUT } from "./constants";

type Getter<T> = () => T;

export type SidebarStateProps = {
	/** Getter for the open state, so `Sidebar.Provider` supports `bind:open`. */
	open: Getter<boolean>;

	/** The single write path for the open state, keeping sub-components and `bind:` in sync. */
	setOpen: (open: boolean) => void;
};

class SidebarState {
	readonly props: SidebarStateProps;
	open = $derived.by(() => this.props.open());
	openMobile = $state(false);
	setOpen: SidebarStateProps["setOpen"];
	#isMobile: IsMobile;
	state = $derived.by(() => (this.open ? "expanded" : "collapsed"));

	constructor(props: SidebarStateProps) {
		this.setOpen = props.setOpen;
		this.#isMobile = new IsMobile();
		this.props = props;
	}

	get isMobile() {
		return this.#isMobile.current;
	}

	// For `<svelte:window onkeydown>`.
	handleShortcutKeydown = (e: KeyboardEvent) => {
		if (e.key === SIDEBAR_KEYBOARD_SHORTCUT && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			this.toggle();
		}
	};

	setOpenMobile = (value: boolean) => {
		this.openMobile = value;
	};

	toggle = () => {
		return this.#isMobile.current ? (this.openMobile = !this.openMobile) : this.setOpen(!this.open);
	};
}

const SYMBOL_KEY = "scn-sidebar";

/** Creates the `SidebarState` and puts it in context. */
export function setSidebar(props: SidebarStateProps): SidebarState {
	return setContext(Symbol.for(SYMBOL_KEY), new SidebarState(props));
}

/** Reads the `SidebarState` from context. A class instance: don't destructure it. */
export function useSidebar(): SidebarState {
	return getContext(Symbol.for(SYMBOL_KEY));
}
