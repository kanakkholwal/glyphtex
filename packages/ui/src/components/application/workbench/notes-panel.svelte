<script lang="ts">
	import { Button } from '@glyphtex/ui/button';
	import { Checkbox } from '@glyphtex/ui/checkbox';
	import { IconNotes, IconPlus, IconTrash, IconX } from '@tabler/icons-svelte';

	import { relativeTime, stripTags, type NoteFilter, type NotesStore } from './notes.svelte';

	/** Per-document checklist, stored on this device. A `#tag` anywhere in the
	 *  text becomes a chip. */
	let {
		notes,
		onclose,
		chromeless = false
	}: {
		notes: NotesStore;
		onclose?: () => void;
		/** Drop the header and the landmark; the host already supplies both. */
		chromeless?: boolean;
	} = $props();

	const filters = $derived<{ id: NoteFilter; label: string; count?: number }[]>([
		{ id: 'all', label: 'All', count: notes.notes.length },
		{ id: 'open', label: 'Open', count: notes.openCount },
		{ id: 'done', label: 'Done', count: notes.doneCount }
	]);

	let field = $state<HTMLInputElement>();
</script>

<svelte:element
	this={chromeless ? 'div' : 'aside'}
	class="flex h-full min-h-0 flex-col {chromeless ? '' : 'border-border bg-card border-l'}"
	aria-label={chromeless ? undefined : 'Notes'}
>
	{#if !chromeless}
		<div class="border-border flex h-9 shrink-0 items-center gap-2 border-b px-2 pl-3">
			<span class="text-foreground text-xs font-medium">Notes</span>
			{#if notes.openCount}
				<span class="text-faint text-xs tabular-nums">{notes.openCount} open</span>
			{/if}
			<div class="ml-auto flex items-center gap-0.5">
				{#if notes.doneCount}
					<Button
						variant="ghost"
						size="icon-sm"
						title="Clear {notes.doneCount} completed"
						aria-label="Clear completed notes"
						onclick={() => notes.clearDone()}
					>
						<IconTrash />
					</Button>
				{/if}
				{#if onclose}
					<Button
						variant="ghost"
						size="icon-sm"
						title="Close notes"
						aria-label="Close notes"
						onclick={() => onclose?.()}
					>
						<IconX />
					</Button>
				{/if}
			</div>
		</div>
	{/if}

	<form
		class="flex shrink-0 items-center gap-1 px-2 pt-2"
		onsubmit={(e) => {
			e.preventDefault();
			notes.add();
			field?.focus();
		}}
	>
		<input
			bind:this={field}
			bind:value={notes.draft}
			class="border-border bg-input focus-visible:ring-ring/40 h-8 min-w-0 flex-1 rounded-md border px-2.5 text-sm outline-none focus-visible:ring-2"
			placeholder="Add a note or #tag"
			aria-label="New note"
		/>
		<Button type="submit" size="icon-sm" disabled={!notes.draft.trim()} aria-label="Add note">
			<IconPlus />
		</Button>
	</form>

	<!-- Counts on the filters, so switching is a decision rather than a probe. -->
	<div class="flex shrink-0 items-center gap-0.5 px-2 pt-2" role="group" aria-label="Filter notes">
		{#each filters as f (f.id)}
			{@const active = notes.filter === f.id}
			<button
				class="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs transition-colors {active
					? 'bg-accent text-foreground font-medium'
					: 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
				aria-pressed={active}
				onclick={() => (notes.filter = f.id)}
			>
				{f.label}
				{#if f.count}<span class="text-faint tabular-nums">{f.count}</span>{/if}
			</button>
		{/each}
	</div>

	<div class="mt-1 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
		{#if notes.visible.length === 0}
			<div class="text-muted-foreground flex flex-col items-center gap-2 py-10 text-center">
				<IconNotes size={20} class="opacity-40" />
				{#if notes.notes.length === 0}
					<p class="text-xs">Nothing noted yet.</p>
					<p class="text-faint text-xs">Notes stay on this device.</p>
				{:else}
					<p class="text-xs">Nothing in this filter.</p>
				{/if}
			</div>
		{:else}
			<ul class="flex flex-col gap-0.5">
				{#each notes.visible as note (note.id)}
					<li class="group hover:bg-accent flex items-start gap-2 rounded-md px-1.5 py-1.5">
						<Checkbox
							class="mt-0.5 shrink-0"
							checked={note.done}
							onCheckedChange={() => notes.toggle(note.id)}
							aria-label={note.done ? 'Mark as open' : 'Mark as done'}
						/>
						<div class="min-w-0 flex-1">
							<p
								class="text-sm leading-snug break-words {note.done
									? 'text-faint line-through'
									: 'text-foreground/90'}"
							>
								{stripTags(note.text)}
							</p>
							<div class="mt-1 flex flex-wrap items-center gap-1">
								<!-- Tags are labels, not links. Brand blue is reserved for things
								     you can click. -->
								{#each note.tags as tag (tag)}
									<span class="bg-accent text-muted-foreground rounded px-1.5 py-px text-xs">
										{tag}
									</span>
								{/each}
								<span class="text-faint ml-auto shrink-0 text-xs">
									{relativeTime(note.at)}
								</span>
							</div>
						</div>
						<button
							class="text-muted-foreground hover:text-destructive grid size-5 shrink-0 place-items-center rounded opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
							title="Delete note"
							aria-label="Delete note"
							onclick={() => notes.remove(note.id)}
						>
							<IconX size={13} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</svelte:element>
