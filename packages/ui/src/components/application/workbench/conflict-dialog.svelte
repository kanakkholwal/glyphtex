<script lang="ts">
  import { Button } from "@glyphx/ui/button";
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "@glyphx/ui/dialog";

  import type { FileStore } from "./files.svelte";

  /**
   * Explorer move/delete prompts: name-conflict resolution (replace / keep both
   * / merge / skip) + destructive confirm. Promise-based — the {@link FileStore}
   * op `await`s `pending.resolve`, which the buttons here call.
   */
  let { files }: { files: FileStore } = $props();
</script>

<Dialog
  open={files.pending !== null}
  onOpenChange={(o) => (o ? null : files.cancelPending())}
>
  <DialogContent class="sm:max-w-md">
    {#if files.pending?.kind === "conflict"}
      <DialogHeader>
        <DialogTitle
          >{files.pending.isFolder ? "Folder" : "File"} already exists</DialogTitle
        >
        <DialogDescription>
          {files.pending.isFolder ? "A folder" : "A file"} named “{files.pending
            .name}” already exists here.{files.pending.canMerge
            ? " Merge their contents, keep both, replace it, or skip."
            : " Keep both (rename), replace it, or skip the move."}
        </DialogDescription>
      </DialogHeader>
      <div class="flex flex-col gap-1.5">
        <span class="text-muted-foreground text-xs">New name</span>
        <input
          bind:value={files.conflictName}
          class="bg-background border-border text-foreground focus-visible:border-ring focus-visible:ring-ring/40 h-9 w-full rounded-md border px-2.5 text-sm outline-none focus-visible:ring-1"
          spellcheck="false"
          onkeydown={(e) => {
            if (e.key === "Enter")
              files.resolveConflict("rename", files.conflictName);
          }}
        />
        {#if files.pending.canApplyAll}
          <label
            class="text-muted-foreground mt-1 flex items-center gap-2 text-xs select-none"
          >
            <input
              type="checkbox"
              bind:checked={files.applyToAll}
              class="accent-brand size-3.5"
            />
            Apply to all remaining conflicts
          </label>
        {/if}
      </div>
      <DialogFooter>
        <Button
          variant="ghost"
          size="sm"
          onclick={() => files.resolveConflict("skip")}>Skip</Button
        >
        {#if files.pending.canMerge}
          <Button
            variant="outline"
            size="sm"
            onclick={() => files.resolveConflict("merge")}
          >
            Merge
          </Button>
        {/if}
        <Button
          variant="destructive"
          size="sm"
          onclick={() => files.resolveConflict("replace")}
        >
          Replace
        </Button>
        <Button
          size="sm"
          onclick={() => files.resolveConflict("rename", files.conflictName)}
          >Keep both</Button
        >
      </DialogFooter>
    {:else if files.pending?.kind === "confirm"}
      <DialogHeader>
        <DialogTitle>{files.pending.title}</DialogTitle>
        <DialogDescription>{files.pending.message}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          variant="ghost"
          size="sm"
          onclick={() => files.resolveConfirm(false)}>Cancel</Button
        >
        <Button
          variant="destructive"
          size="sm"
          onclick={() => files.resolveConfirm(true)}
        >
          {files.pending.confirmLabel}
        </Button>
      </DialogFooter>
    {/if}
  </DialogContent>
</Dialog>
