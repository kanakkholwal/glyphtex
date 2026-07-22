<script lang="ts">
  import { Button } from "@glyphx/ui/button";
  import {
    IconCheck,
    IconCloud,
    IconPencil,
    IconPlus,
    IconTrash,
    IconX,
  } from '@glyphx/ui/icons';
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";

  import SectionHeader from "./section-header.svelte";
  import type { GitPanelStore } from "./store.svelte";
  import { INPUT_CLS } from "./types";

  /**
   * Remotes section — add / edit / switch / remove remotes, an optional access
   * token for private HTTPS repos, and Fetch / Pull / Push actions.
   */
  let { store }: { store: GitPanelStore } = $props();
</script>

<div class="border-border/60 mt-1 border-t pt-1.5">
  <div class="flex items-center gap-0.5 px-0.5">
    <SectionHeader
      {store}
      title="Remotes"
      sectionKey="remotes"
      count={store.remotes.length || null}
    />
    <Button
      variant="ghost"
      size="xs"
      title="Add a remote"
      disabled={store.busy}
      onclick={() => store.startAddRemote()}
    >
      <IconPlus size={12} /> Add
    </Button>
  </div>

  {#if store.sections.remotes}
    <div
      transition:slide={{ duration: 200, easing: cubicOut }}
      class="mt-1 flex flex-col gap-1.5"
    >
      <!-- Add-remote form -->
      {#if store.addingRemote}
        <div class="border-border/60 flex flex-col gap-1 rounded border p-1.5">
          <input
            bind:value={store.newRemoteName}
            placeholder="Name (e.g. origin)"
            class={INPUT_CLS}
          />
          <input
            bind:value={store.newRemoteUrl}
            placeholder="https://github.com/owner/repo.git"
            class={INPUT_CLS}
          />
          <div class="flex gap-1.5">
            <Button
              size="xs"
              disabled={store.busy ||
                !store.newRemoteName.trim() ||
                !store.newRemoteUrl.trim()}
              onclick={() => store.addRemote()}
            >
              Add remote
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onclick={() => (store.addingRemote = false)}>Cancel</Button
            >
          </div>
        </div>
      {/if}

      <!-- Remote list (radio = active when several) -->
      {#each store.remotes as r (r.name)}
        {#if store.editingRemote === r.name}
          <div class="border-border/60 flex flex-col gap-1 rounded border p-1.5">
            <input bind:value={store.editName} placeholder="Name" class={INPUT_CLS} />
            <input bind:value={store.editUrl} placeholder="URL" class={INPUT_CLS} />
            <div class="flex gap-1.5">
              <Button
                size="xs"
                disabled={store.busy || !store.editName.trim() || !store.editUrl.trim()}
                onclick={() => store.saveRemote(r)}
              >
                <IconCheck size={12} /> Save
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onclick={() => (store.editingRemote = null)}
              >
                <IconX size={12} /> Cancel
              </Button>
            </div>
          </div>
        {:else}
          <div
            class="hover:bg-muted/60 group flex items-center gap-1.5 rounded px-1 py-0.5 text-xs"
          >
            {#if store.remotes.length > 1}
              <input
                type="radio"
                name="active-remote"
                class="accent-brand shrink-0"
                checked={store.activeRemote?.name === r.name}
                title="Use this remote for fetch / pull / push"
                onchange={() => (store.selectedRemote = r.name)}
              />
            {:else}
              <IconCloud size={12} class="text-muted-foreground shrink-0" />
            {/if}
            <div class="min-w-0 flex-1">
              <p class="text-foreground/90 truncate font-medium">{r.name}</p>
              <p class="text-muted-foreground/70 truncate text-[10px]" title={r.url}>
                {r.url}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              class="opacity-0 group-hover:opacity-100"
              title="Edit remote"
              aria-label="Edit remote"
              disabled={store.busy}
              onclick={() => store.startEditRemote(r)}
            >
              <IconPencil size={12} />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
              title="Remove remote"
              aria-label="Remove remote"
              disabled={store.busy}
              onclick={() => store.removeRemote(r)}
            >
              <IconTrash size={12} />
            </Button>
          </div>
        {/if}
      {/each}

      {#if store.hasRemote}
        <div class="flex items-center gap-1 px-0.5">
          {#if store.activeRemote}
            <span class="text-muted-foreground/70 text-[10px]">
              Using <span class="text-foreground/80 font-medium"
                >{store.activeRemote.name}</span
              >
            </span>
          {/if}
          <button
            class="text-muted-foreground hover:text-foreground ml-auto text-[10px]"
            onclick={() => (store.showToken = !store.showToken)}
          >
            {store.showToken ? "Hide token" : "Token"}
          </button>
        </div>
        {#if store.showToken}
          <input
            type="password"
            bind:value={store.token}
            placeholder="Access token (for private repos)"
            class={INPUT_CLS}
          />
        {/if}
        <div class="flex gap-1.5">
          <Button variant="outline" size="xs" disabled={store.busy} onclick={() => store.doFetch()}>Fetch</Button>
          <Button variant="outline" size="xs" disabled={store.busy} onclick={() => store.doPull()}>Pull</Button>
          <Button variant="outline" size="xs" disabled={store.busy} onclick={() => store.doPush()}>Push</Button>
        </div>
        {#if store.remoteMsg}
          <p class="text-muted-foreground/80 px-0.5 text-[11px] leading-snug break-words">
            {store.remoteMsg}
          </p>
        {/if}
      {:else if !store.addingRemote}
        <p class="text-muted-foreground/70 px-0.5 text-[11px]">
          No remotes. Add one to push or pull.
        </p>
      {/if}
    </div>
  {/if}
</div>
