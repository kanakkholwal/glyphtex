import { PersistedState } from "@glyphtex/ui/persisted-state";

type Flags = { compiled: boolean; shared: boolean; dismissed: boolean };

/** First-run facts no store can answer later. Project count and sign-in are derived elsewhere. */
class Onboarding {
	#flags = new PersistedState<Flags>("glyphtex:onboarding", {
		compiled: false,
		shared: false,
		dismissed: false
	});

	get compiled() {
		return this.#flags.current.compiled;
	}
	get shared() {
		return this.#flags.current.shared;
	}
	get dismissed() {
		return this.#flags.current.dismissed;
	}

	#set(change: Partial<Flags>) {
		const next = { ...this.#flags.current, ...change };
		const same = (Object.keys(change) as (keyof Flags)[]).every(
			(k) => this.#flags.current[k] === next[k]
		);
		if (!same) this.#flags.current = next;
	}

	markCompiled = () => this.#set({ compiled: true });
	markShared = () => this.#set({ shared: true });
	dismiss = () => this.#set({ dismissed: true });
}

export const onboarding = new Onboarding();
