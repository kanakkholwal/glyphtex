const number = new Intl.NumberFormat("en-US");
export const formatNumber = (n: number) => number.format(n);

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ["KB", "MB", "GB", "TB"];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export const formatDate = (iso: string | Date) =>
	new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

export const formatDateTime = (iso: string | Date) =>
	new Date(iso).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit"
	});

/** Percent change of the second half of a daily series against the first, 0 when there is no base. */
export function halfTrend(series: { count: number }[]): number {
	const mid = Math.floor(series.length / 2);
	const before = series.slice(0, mid).reduce((n, d) => n + d.count, 0);
	const after = series.slice(mid).reduce((n, d) => n + d.count, 0);
	return before === 0 ? 0 : Math.round(((after - before) / before) * 1000) / 10;
}
