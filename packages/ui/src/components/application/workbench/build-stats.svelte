<script lang="ts">
  import type { CompileStore } from "./compile.svelte";

  /** Build time / pages / output size for the last compile, with a sparkline of
   *  recent build times so a slowdown is visible before it becomes annoying. */
  let {
    compile,
    note,
  }: {
    compile: CompileStore;
    /** Host-supplied engine line (e.g. "Engine: on-device"). */
    note?: string;
  } = $props();

  const W = 100;
  const H = 28;

  const builds = $derived(compile.builds);
  const peak = $derived(Math.max(1, ...builds.map((b) => b.ms)));

  const points = $derived(
    builds.map((b, i) => ({
      ...b,
      x: builds.length < 2 ? W : (i / (builds.length - 1)) * W,
      y: H - (b.ms / peak) * (H - 4) - 2,
    })),
  );
  const line = $derived(points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "));
  const area = $derived(
    points.length > 1 ? `${line} ${W},${H} 0,${H}` : "",
  );

  function bytes(n: number): string {
    if (!n) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  const rows = $derived([
    {
      label: "Build time",
      value:
        compile.lastCompileMs == null
          ? "—"
          : `${(compile.lastCompileMs / 1000).toFixed(1)}s`,
    },
    { label: "Pages", value: compile.pdfNumPages ? String(compile.pdfNumPages) : "—" },
    { label: "Output", value: bytes(compile.outputBytes) },
  ]);
</script>

<aside
  class="border-border bg-background hidden w-56 shrink-0 flex-col gap-2 rounded-lg border p-3 lg:flex"
  aria-label="Build statistics"
>
  {#each rows as row (row.label)}
    <div class="flex items-baseline justify-between gap-2">
      <span class="text-faint text-xs">{row.label}</span>
      <span class="text-foreground text-sm font-medium tabular-nums">{row.value}</span>
    </div>
  {/each}

  {#if points.length > 1}
    <svg
      class="mt-1 w-full"
      viewBox="0 0 {W} {H}"
      preserveAspectRatio="none"
      height={H}
      role="img"
      aria-label="Build time over the last {points.length} compiles, peaking at {(
        peak / 1000
      ).toFixed(1)} seconds; {points.filter((p) => !p.ok).length} failed"
    >
      <polygon points={area} class="fill-brand/12" />
      <polyline
        points={line}
        fill="none"
        class="stroke-brand"
        stroke-width="1.25"
        vector-effect="non-scaling-stroke"
        stroke-linejoin="round"
      />
      {#each points as p, i (i)}
        {#if !p.ok}
          <circle cx={p.x} cy={p.y} r="1.75" class="fill-destructive" />
        {/if}
      {/each}
    </svg>
  {/if}

  {#if note}
    <p class="text-faint border-border/70 mt-auto border-t pt-2 text-xs">{note}</p>
  {/if}
</aside>
