<script lang="ts">
  import { Button } from "@glyphtex/ui/button";
  import { Checkbox } from "@glyphtex/ui/checkbox";
  import { IconPlus, IconTrash, IconX } from "@tabler/icons-svelte";

  import { relativeTime, stripTags, type NoteFilter, type NotesStore } from "./notes.svelte";

  /** Per-document checklist. Local to this device, like everything else here —
   *  `#tag` anywhere in the text becomes a chip. */
  let {
    notes,
    onclose,
  }: { notes: NotesStore; onclose?: () => void } = $props();

  const FILTERS: { id: NoteFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "open", label: "Open" },
    { id: "done", label: "Done" },
  ];

  let field = $state<HTMLInputElement>();
</script>

<aside
  class="border-border bg-card flex h-full min-h-0 flex-col border-l"
  aria-label="Notes"
>
  <div class="border-border flex h-8 shrink-0 items-center gap-2 border-b px-2">
    <span class="text-foreground text-xs font-medium">Notes</span>
    {#if notes.openCount}
      <span class="text-faint text-xs tabular-nums">{notes.openCount} open</span>
    {/if}
    <div class="ml-auto flex items-center gap-0.5">
      {#if notes.doneCount}
        <button
          class="text-muted-foreground hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
          title="Clear {notes.doneCount} completed"
          aria-label="Clear completed notes"
          onclick={() => notes.clearDone()}
        >
          <IconTrash size={14} />
        </button>
      {/if}
      {#if onclose}
        <button
          class="text-muted-foreground hover:bg-muted hover:text-foreground grid size-6 place-items-center rounded transition-colors"
          title="Close notes"
          aria-label="Close notes"
          onclick={() => onclose?.()}
        >
          <IconX size={15} />
        </button>
      {/if}
    </div>
  </div>

  <div class="flex shrink-0 items-center gap-1 px-2 pt-2">
    {#each FILTERS as f (f.id)}
      {@const active = notes.filter === f.id}
      <button
        class="rounded px-1.5 py-0.5 text-xs transition-colors {active
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:text-foreground'}"
        aria-pressed={active}
        onclick={() => (notes.filter = f.id)}
      >
        {f.label}
      </button>
    {/each}
  </div>

  <form
    class="flex shrink-0 items-center gap-1 px-2 py-2"
    onsubmit={(e) => {
      e.preventDefault();
      notes.add();
      field?.focus();
    }}
  >
    <input
      bind:this={field}
      bind:value={notes.draft}
      class="border-border bg-input focus:ring-ring/50 min-w-0 flex-1 rounded-md border px-2 py-1 text-sm outline-none focus:ring-2"
      placeholder="Add a note or #tag…"
      aria-label="New note"
    />
    <Button
      type="submit"
      variant="ghost"
      size="icon-sm"
      disabled={!notes.draft.trim()}
      aria-label="Add note"
    >
      <IconPlus />
    </Button>
  </form>

  <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
    {#if notes.visible.length === 0}
      <p class="text-muted-foreground px-1 py-6 text-center text-xs leading-relaxed">
        {notes.notes.length === 0
          ? "Jot down what’s left to do in this document. Notes stay on this device."
          : "Nothing in this filter."}
      </p>
    {:else}
      <ul class="flex flex-col gap-0.5">
        {#each notes.visible as note (note.id)}
          <li class="group hover:bg-muted/60 flex items-start gap-2 rounded-md px-1.5 py-1.5">
            <Checkbox
              class="mt-0.5 shrink-0"
              checked={note.done}
              onCheckedChange={() => notes.toggle(note.id)}
              aria-label={note.done ? "Mark as open" : "Mark as done"}
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
                {#each note.tags as tag (tag)}
                  <span
                    class="bg-brand-subtle text-brand rounded px-1.5 py-px text-xs font-medium"
                  >
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
</aside>
