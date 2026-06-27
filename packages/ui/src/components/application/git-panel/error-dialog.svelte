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
  import { IconAlertTriangle, IconChevronRight } from "@tabler/icons-svelte";

  import type { GitPanelStore } from "./store.svelte";

  /**
   * Remote error dialog (our own UI, not the native one). Plain-language title +
   * message, with the raw error tucked behind "Show details" for the curious.
   */
  let { store }: { store: GitPanelStore } = $props();
</script>

<Dialog
  open={!!store.gitError}
  onOpenChange={(o) => {
    if (!o) store.gitError = undefined;
  }}
>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle class="flex items-center gap-2">
        <span class="text-destructive shrink-0"><IconAlertTriangle size={18} /></span>
        {store.gitError?.title}
      </DialogTitle>
      <DialogDescription class="leading-relaxed">
        {store.gitError?.message}
      </DialogDescription>
    </DialogHeader>

    {#if store.gitError?.details}
      <div class="text-xs">
        <button
          class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          onclick={() => (store.showErrorDetails = !store.showErrorDetails)}
        >
          <IconChevronRight
            size={13}
            class="transition-transform duration-200 {store.showErrorDetails
              ? 'rotate-90'
              : ''}"
          />
          {store.showErrorDetails ? "Hide details" : "Show details"}
        </button>
        {#if store.showErrorDetails}
          <pre
            class="border-border/60 bg-muted/40 text-muted-foreground mt-1.5 max-h-40 overflow-auto rounded border p-2 font-mono text-[11px] leading-snug whitespace-pre-wrap">{store
              .gitError.details}</pre>
        {/if}
      </div>
    {/if}

    <DialogFooter>
      <Button size="sm" onclick={() => (store.gitError = undefined)}>Dismiss</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
