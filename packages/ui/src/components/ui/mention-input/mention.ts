export type MentionKind = "person" | "channel";

export type MentionPerson = {
	id: string;
	name: string;
	/** One short line under the name, such as a job title. */
	role?: string;
	/** Portrait URL; initials show when it is missing. */
	avatar?: string;
};

export type MentionChannel = {
	id: string;
	name: string;
	description?: string;
};

/** A mention inside `text`; `start` and `end` are offsets around `@label` or `#label`. */
export type Mention = {
	kind: MentionKind;
	id: string;
	label: string;
	start: number;
	end: number;
};
export type MentionValue = { text: string; mentions: Mention[] };
export type MentionTrigger = { kind: MentionKind; start: number; query: string };
export type MentionSuggestion = {
	kind: MentionKind;
	id: string;
	label: string;
	detail?: string;
	avatar?: string;
};

export const EMPTY_MENTIONS: MentionValue = { text: "", mentions: [] };
const SYMBOL: Record<MentionKind, string> = { person: "@", channel: "#" };
export const mentionText = (kind: MentionKind, label: string) =>
	`${SYMBOL[kind]}${label}`;

/** Storage-friendly text: `<@id>` for people and `<#id>` for channels by default. */
export function serializeMentions(
	value: MentionValue,
	format: (mention: Mention) => string = (mention) =>
		`<${SYMBOL[mention.kind]}${mention.id}>`,
) {
	let out = "";
	let at = 0;
	for (const mention of [...value.mentions].sort((a, b) => a.start - b.start)) {
		out += value.text.slice(at, mention.start) + format(mention);
		at = mention.end;
	}
	return out + value.text.slice(at);
}

/** Moves mentions along with an edit and drops any it touched; `hint` is the caret before the edit. */
export function reconcileMentions(
	previous: MentionValue,
	text: string,
	hint: number,
): Mention[] {
	const a = previous.text;
	let prefix = 0;
	const maxPrefix = Math.min(a.length, text.length, Math.max(0, hint));
	while (prefix < maxPrefix && a[prefix] === text[prefix]) prefix++;
	let suffix = 0;
	while (
		suffix < a.length - prefix &&
		suffix < text.length - prefix &&
		a[a.length - 1 - suffix] === text[text.length - 1 - suffix]
	)
		suffix++;
	const oldEnd = a.length - suffix;
	const delta = text.length - a.length;
	return previous.mentions
		.flatMap((mention) => {
			if (mention.end <= prefix) return [mention];
			if (mention.start >= oldEnd)
				return [{ ...mention, start: mention.start + delta, end: mention.end + delta }];
			return [];
		})
		.filter(
			(mention) =>
				text.slice(mention.start, mention.end) ===
				mentionText(mention.kind, mention.label),
		);
}

/** The open `@` or `#` before the caret, if the text since it can still be a name. */
export function findTrigger(
	text: string,
	caret: number,
	mentions: Mention[],
	kinds: Record<MentionKind, boolean>,
): MentionTrigger | null {
	for (let index = caret - 1; index >= 0 && index >= caret - 48; index--) {
		const char = text[index];
		if (char === "\n") return null;
		if (char !== "@" && char !== "#") continue;
		const kind: MentionKind = char === "@" ? "person" : "channel";
		if (!kinds[kind]) return null;
		if (index > 0 && !/[\s([{"']/.test(text[index - 1] ?? "")) return null;
		if (mentions.some((mention) => index >= mention.start && index < mention.end))
			return null;
		const query = text.slice(index + 1, caret);
		const shape = kind === "person" ? /^[^\s@#]*( [^\s@#]*)?$/ : /^[^\s@#]*$/;
		return shape.test(query) ? { kind, start: index, query } : null;
	}
	return null;
}

function score(label: string, extra: string, query: string) {
	const name = label.toLowerCase();
	if (!query) return 1;
	if (name.startsWith(query)) return 4;
	if (name.split(/[\s\-_.]+/).some((word) => word.startsWith(query))) return 3;
	if (name.includes(query)) return 2;
	return extra.toLowerCase().includes(query) ? 1 : 0;
}

/** People or channels matching the trigger's query, best first. */
export function suggestMentions(
	trigger: MentionTrigger,
	people: MentionPerson[],
	channels: MentionChannel[],
	limit: number,
): MentionSuggestion[] {
	const query = trigger.query.toLowerCase();
	const pool: MentionSuggestion[] =
		trigger.kind === "person"
			? people.map((p) => ({
					kind: "person",
					id: p.id,
					label: p.name,
					detail: p.role,
					avatar: p.avatar,
				}))
			: channels.map((c) => ({
					kind: "channel",
					id: c.id,
					label: c.name,
					detail: c.description,
				}));
	return pool
		.map((item, order) => ({
			item,
			order,
			rank: score(item.label, item.detail ?? "", query),
		}))
		.filter((entry) => entry.rank > 0)
		.sort((a, b) => b.rank - a.rank || a.order - b.order)
		.slice(0, limit)
		.map((entry) => entry.item);
}

/** Replaces the trigger with a mention and a trailing space. */
export function insertMention(
	value: MentionValue,
	trigger: MentionTrigger,
	caret: number,
	pick: MentionSuggestion,
) {
	const token = mentionText(pick.kind, pick.label);
	const text = `${value.text.slice(0, trigger.start)}${token} ${value.text.slice(caret)}`;
	const shift = token.length + 1 - (caret - trigger.start);
	const mention: Mention = {
		kind: pick.kind,
		id: pick.id,
		label: pick.label,
		start: trigger.start,
		end: trigger.start + token.length,
	};
	const mentions = [
		...value.mentions
			.filter((m) => m.end <= trigger.start || m.start >= caret)
			.map((m) =>
				m.start >= caret ? { ...m, start: m.start + shift, end: m.end + shift } : m,
			),
		mention,
	].sort((a, b) => a.start - b.start);
	return { value: { text, mentions }, caret: mention.end + 1, mention };
}

/** A caret or selection edge never lands inside a mention: it steps to the nearer end. */
export function snapOutOfMentions(position: number, mentions: Mention[]) {
	const hit = mentions.find((m) => position > m.start && position < m.end);
	if (!hit) return position;
	return position - hit.start < hit.end - position ? hit.start : hit.end;
}

export const initials = (name: string) =>
	name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
