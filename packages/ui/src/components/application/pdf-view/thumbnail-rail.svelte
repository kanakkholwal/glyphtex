<script lang="ts">
  import type { PdfViewController } from "./controller.svelte";

  /** Page thumbnails down the preview's outer edge. Pages paint as they scroll
   *  into the rail, so a 400-page document doesn't render 400 canvases up front. */
  let {
    ctrl,
    current = 1,
    count = 0,
    ongoto,
  }: {
    ctrl: PdfViewController;
    current?: number;
    count?: number;
    ongoto?: (page: number) => void;
  } = $props();

  let listEl = $state<HTMLElement>();
  let canvases = $state<(HTMLCanvasElement | undefined)[]>([]);
  let painted = new Set<string>();

  const pages = $derived(Array.from({ length: count }, (_, i) => i + 1));

  function paint(n: number): void {
    const key = `${ctrl.docVersion}:${n}`;
    const canvas = canvases[n - 1];
    if (!canvas || painted.has(key)) return;
    painted.add(key);
    void ctrl.renderThumbnail(n, canvas).catch(() => painted.delete(key));
  }

  // A recompile replaces the document, so every cached thumbnail is stale.
  $effect(() => {
    void ctrl.docVersion;
    void count;
    painted = new Set();
    const root = listEl;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const n = Number((e.target as HTMLElement).dataset.page);
          if (n) paint(n);
        }
      },
      { root, rootMargin: "240px 0px" },
    );
    for (const el of root.querySelectorAll<HTMLElement>("[data-page]")) io.observe(el);
    return () => io.disconnect();
  });

  // Follow the viewport: scrolling the PDF keeps the matching thumbnail visible.
  $effect(() => {
    listEl
      ?.querySelector(`[data-page="${current}"]`)
      ?.scrollIntoView({ block: "nearest" });
  });
</script>

<div
  bind:this={listEl}
  class="border-border bg-card h-full w-30 shrink-0 overflow-y-auto border-l px-2 py-2"
  aria-label="Page thumbnails"
>
  <ul class="flex flex-col items-center gap-2">
    {#each pages as n (n)}
      {@const active = n === current}
      <li>
        <button
          data-page={n}
          class="group flex flex-col items-center gap-1 rounded-md p-1 transition-colors {active
            ? 'bg-brand-subtle'
            : 'hover:bg-muted'}"
          aria-label="Page {n}"
          aria-current={active ? "page" : undefined}
          onclick={() => ongoto?.(n)}
        >
          <canvas
            bind:this={canvases[n - 1]}
            class="border-border block w-[104px] rounded-[3px] border bg-white shadow-sm transition-[outline-color] {active
              ? 'outline-brand outline-2'
              : 'outline-transparent outline-2'}"
            style:height="134px"
          ></canvas>
          <span
            class="text-xs tabular-nums {active ? 'text-brand font-medium' : 'text-faint'}"
          >
            {n}
          </span>
        </button>
      </li>
    {/each}
  </ul>
</div>
