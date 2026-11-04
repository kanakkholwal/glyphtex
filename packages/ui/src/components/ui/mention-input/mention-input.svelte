<script lang="ts">
import { tick, untrack } from "svelte";
import Avatar from "../avatar/avatar.svelte";
import AvatarFallback from "../avatar/avatar-fallback.svelte";
import AvatarImage from "../avatar/avatar-image.svelte";
import { cn } from "../../../lib/cn.js";
import {
	EMPTY_MENTIONS,
	findTrigger,
	initials,
	insertMention,
	type Mention,
	type MentionChannel,
	type MentionPerson,
	type MentionValue,
	reconcileMentions,
	snapOutOfMentions,
	suggestMentions,
} from "./mention";
import { type MentionInputSize, mentionInput } from "./variants";

let {
	value = $bindable(),
	onValueChange,
	people,
	channels,
	onMentionAdd,
	onSubmit,
	submitOnEnter = false,
	placeholder,
	minRows = 2,
	maxRows = 8,
	side = "bottom",
	size = "default",
	maxSuggestions = 6,
	disabled = false,
	name,
	"aria-label": ariaLabel = "Message",
	class: classProp,
}: {
	/** Bindable. */
	value?: MentionValue;
	onValueChange?: (value: MentionValue) => void;
	/** People offered after `@`; leave it out to turn person mentions off. */
	people?: MentionPerson[];
	/** Channels offered after `#`; leave it out to turn channel mentions off. */
	channels?: MentionChannel[];
	onMentionAdd?: (mention: Mention) => void;
	/** With `submitOnEnter`, Enter submits and Shift+Enter adds a line. */
	onSubmit?: (value: MentionValue) => void;
	submitOnEnter?: boolean;
	placeholder?: string;
	minRows?: number;
	/** The field grows to this many rows, then scrolls. */
	maxRows?: number;
	/** Which side of the field the suggestions open on. */
	side?: "top" | "bottom";
	size?: MentionInputSize;
	maxSuggestions?: number;
	disabled?: boolean;
	/** Submits the text with mentions as typed. */
	name?: string;
	"aria-label"?: string;
	class?: string;
} = $props();

const uid = $props.id();
const listId = `${uid}-list`;
let own = $state(untrack(() => value ?? EMPTY_MENTIONS));
const current = $derived(value ?? own);
let caret = $state<number | null>(null);
let active = $state(0);
let dismissed = $state<number | null>(null);
let area = $state<HTMLTextAreaElement>();
let mirror = $state<HTMLDivElement>();
let lastCaret = 0;

const kinds = $derived({ person: !!people, channel: !!channels });
const trigger = $derived(
	caret === null ? null : findTrigger(current.text, caret, current.mentions, kinds),
);
const open = $derived(!!trigger && trigger.start !== dismissed);
const suggestions = $derived(
	trigger ? suggestMentions(trigger, people ?? [], channels ?? [], maxSuggestions) : [],
);
const activeIndex = $derived(Math.min(active, Math.max(0, suggestions.length - 1)));

function commit(next: MentionValue) {
	if (value === undefined) own = next;
	else value = next;
	onValueChange?.(next);
}
async function placeCaret(position: number) {
	await tick();
	area?.setSelectionRange(position, position);
}
function choose(index: number) {
	const pick = suggestions[index];
	if (!pick || !trigger || caret === null) return;
	const result = insertMention(current, trigger, caret, pick);
	commit(result.value);
	caret = result.caret;
	active = 0;
	placeCaret(result.caret);
	onMentionAdd?.(result.mention);
}
function syncCaret() {
	if (!area) return;
	let start = snapOutOfMentions(area.selectionStart, current.mentions);
	let end = snapOutOfMentions(area.selectionEnd, current.mentions);
	if (start > end) [start, end] = [end, start];
	if (start !== area.selectionStart || end !== area.selectionEnd)
		area.setSelectionRange(start, end);
	lastCaret = area.selectionStart;
	caret = start === end ? start : null;
}
function onkeydown(event: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) {
	const el = event.currentTarget;
	lastCaret = el.selectionStart;
	if (open && suggestions.length) {
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			active = (activeIndex + step + suggestions.length) % suggestions.length;
			return;
		}
		if (event.key === "Enter" || event.key === "Tab") {
			event.preventDefault();
			choose(activeIndex);
			return;
		}
	}
	if (open && event.key === "Escape") {
		event.preventDefault();
		dismissed = trigger?.start ?? null;
		return;
	}
	const start = el.selectionStart;
	const end = el.selectionEnd;
	// One Backspace or Delete removes a whole mention.
	if (
		start === end &&
		!event.metaKey &&
		(event.key === "Backspace" || event.key === "Delete")
	) {
		const hit = current.mentions.find((m) =>
			event.key === "Backspace"
				? start > m.start && start <= m.end
				: start >= m.start && start < m.end,
		);
		if (hit) {
			event.preventDefault();
			const gap = hit.end - hit.start;
			commit({
				text: current.text.slice(0, hit.start) + current.text.slice(hit.end),
				mentions: current.mentions
					.filter((m) => m !== hit)
					.map((m) =>
						m.start > hit.start ? { ...m, start: m.start - gap, end: m.end - gap } : m,
					),
			});
			caret = hit.start;
			placeCaret(hit.start);
			return;
		}
	}
	if (submitOnEnter && event.key === "Enter" && !event.shiftKey && !event.isComposing) {
		event.preventDefault();
		onSubmit?.(current);
	}
}

const s = $derived(mentionInput({ size }));
const pieces = $derived.by(() => {
	const out: { text: string; mention?: Mention }[] = [];
	let at = 0;
	for (const m of current.mentions) {
		out.push({ text: current.text.slice(at, m.start) });
		out.push({ text: current.text.slice(m.start, m.end), mention: m });
		at = m.end;
	}
	out.push({ text: `${current.text.slice(at)} ` });
	return out;
});
</script>

<div data-slot="mention-input" class={cn(s.root(), classProp)}>
	<div class={s.frame()} style="--mi-min: {minRows}; --mi-max: {maxRows}">
		<div
			bind:this={mirror}
			aria-hidden="true"
			class={s.mirror()}
		>{#each pieces as piece, i (i)}{#if piece.mention}<span data-mention="" class={s.chip()}>{piece.text}</span>{:else}{piece.text}{/if}{/each}</div>
		<textarea
			bind:this={area}
			role="combobox"
			aria-label={ariaLabel}
			aria-expanded={open}
			aria-controls={open ? listId : undefined}
			aria-autocomplete="list"
			aria-activedescendant={open && suggestions[activeIndex] ? `${listId}-${activeIndex}` : undefined}
			rows={minRows}
			{disabled}
			{placeholder}
			value={current.text}
			class={s.area()}
			oninput={(event) => {
				const el = event.currentTarget;
				commit({ text: el.value, mentions: reconcileMentions(current, el.value, lastCaret) });
				caret = el.selectionStart === el.selectionEnd ? el.selectionStart : null;
				lastCaret = el.selectionStart;
				active = 0;
				dismissed = null;
			}}
			onselect={syncCaret}
			onkeyup={syncCaret}
			onclick={syncCaret}
			{onkeydown}
			onblur={() => (caret = null)}
			onscroll={(event) => {
				if (mirror) mirror.scrollTop = event.currentTarget.scrollTop;
			}}
		></textarea>
	</div>
	{#if open}
		<div id={listId} role="listbox" data-side={side} aria-label={trigger?.kind === "person" ? "People" : "Channels"} class={s.list()}>
			{#if suggestions.length === 0}<div class={s.empty()}>No matches</div>{/if}
			{#each suggestions as item, index (`${item.kind}:${item.id}`)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					id="{listId}-{index}"
					role="option"
					tabindex="-1"
					aria-selected={index === activeIndex}
					data-active={index === activeIndex}
					class={s.option()}
					onpointerdown={(event) => event.preventDefault()}
					onpointermove={() => (active = index)}
					onclick={() => choose(index)}
				>
					{#if item.kind === "person"}
						<Avatar size="sm" class="size-6 text-xs">
							<AvatarFallback>{initials(item.label)}</AvatarFallback>
							{#if item.avatar}<AvatarImage src={item.avatar} alt="" />{/if}
						</Avatar>
					{:else}
						<span aria-hidden="true" class={s.hash()}>#</span>
					{/if}
					<span class="grid min-w-0">
						<span class="truncate">{item.label}</span>
						{#if item.detail}<span class={s.detail()}>{item.detail}</span>{/if}
					</span>
				</div>
			{/each}
		</div>
	{/if}
	{#if name}<input type="hidden" {name} value={current.text} />{/if}
</div>
