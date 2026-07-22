<script lang="ts">
  import { Button } from "@glyphtex/ui/button";
  import { IconAlertTriangle, IconUser } from '@tabler/icons-svelte';
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";

  import type { GitPanelStore } from "./store.svelte";
  import { INPUT_CLS } from "./types";

  /** Commit identity, plus the relay remote requests go through where the host
   *  needs one. Hidden entirely when the host manages these itself. */
  let { store }: { store: GitPanelStore } = $props();
</script>

{#if store.canEditSettings}
  <div class="border-border/60 mt-1 border-t pt-1.5">
    {#if store.needsIdentity && store.staged.length > 0 && !store.showSettings}
      <button
        class="border-warning/40 bg-warning/10 text-foreground/90 flex w-full items-start gap-1.5 rounded border px-1.5 py-1 text-left text-xs"
        onclick={() => store.startEditSettings()}
      >
        <IconAlertTriangle size={13} class="text-warning mt-px shrink-0" />
        <span>
          Set a name and email, or this commit is attributed to
          “{store.settings?.name}”.
        </span>
      </button>
    {:else if !store.showSettings}
      <button
        class="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-0.5 text-xs"
        onclick={() => store.startEditSettings()}
      >
        <IconUser size={12} class="shrink-0" />
        <span class="truncate">
          {store.settings?.chosen
            ? `${store.settings.name} <${store.settings.email}>`
            : "Set who commits"}
        </span>
      </button>
    {/if}

    {#if store.showSettings}
      <div
        transition:slide={{ duration: 200, easing: cubicOut }}
        class="border-border/60 flex flex-col gap-1 rounded border p-1.5"
      >
        <p class="text-muted-foreground/70 text-xs">Commits are signed with</p>
        <input bind:value={store.authorName} placeholder="Your name" class={INPUT_CLS} />
        <input
          bind:value={store.authorEmail}
          type="email"
          placeholder="you@example.com"
          class={INPUT_CLS}
        />

        {#if store.relayApplies}
          <p class="text-muted-foreground/70 mt-1 text-xs leading-snug">
            Browsers can’t reach Git servers directly, so fetch, pull and push are
            relayed through this address — it sees your traffic and your token.
            Leave it blank to disable remote access entirely.
          </p>
          <input
            bind:value={store.proxyUrl}
            placeholder="https://cors.isomorphic-git.org"
            class={INPUT_CLS}
          />
        {/if}

        <div class="mt-0.5 flex gap-1.5">
          <Button
            size="xs"
            disabled={store.busy ||
              !store.authorName.trim() ||
              !store.authorEmail.trim()}
            onclick={() => store.saveSettings()}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onclick={() => (store.showSettings = false)}>Cancel</Button
          >
        </div>
      </div>
    {/if}
  </div>
{/if}
