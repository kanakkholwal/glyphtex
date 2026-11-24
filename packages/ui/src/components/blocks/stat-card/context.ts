import { getContext, setContext } from "svelte";
import type { Datum } from "../../charts/chart/core.js";
import type { StatCardChartKind, StatCardPositive, StatCardStatus, statCard } from "./variants";

/** What StatCard shares with its parts; read through getters so they stay reactive. */
export interface StatCardState {
	readonly name: string;
	readonly data: Datum[];
	readonly dataKey: string;
	readonly xKey: string;
	readonly value: number;
	readonly label: string;
	readonly trend: number;
	readonly comparisonLabel?: string;
	readonly positive: StatCardPositive;
	readonly chart: StatCardChartKind;
	readonly color: string;
	readonly locale?: string;
	readonly status: StatCardStatus;
	readonly activeIndex: number | null;
	readonly number: (value: number) => string;
	readonly formatLabel: (date: Date) => string;
	readonly styles: ReturnType<typeof statCard>;
	setActive(index: number | null): void;
}

const KEY = Symbol("stat-card");

export const setStatCard = (state: StatCardState) => setContext(KEY, state);
export function statCardState(): StatCardState {
	const state = getContext<StatCardState | undefined>(KEY);
	if (!state) throw new Error("StatCard parts must be rendered inside a StatCard.");
	return state;
}
