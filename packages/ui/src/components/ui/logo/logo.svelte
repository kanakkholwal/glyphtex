<script lang="ts" module>
  export type LogoSize = "sm" | "md" | "lg" | "xl";
  /** Glyph fill: brand `gradient` (default), `mono` (currentColor), or solid
   *  `white` / `dark` for placement on coloured surfaces. */
  export type LogoTone = "gradient" | "mono" | "white" | "dark";

  const MARK_PX: Record<LogoSize, number> = { sm: 20, md: 24, lg: 44, xl: 72 };
  const TEXT_CLS: Record<LogoSize, string> = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-2xl",
    xl: "text-4xl",
  };
</script>

<script lang="ts">
  import { cn } from "@glyphtex/ui/utils";

  /**
   * Logo — the GlyphTeX brand lockup: a geometric "G" glyph mark plus an optional
   * wordmark. Reusable everywhere (top bar, empty states, marketing).
   *
   * - `badge` (default) sets the mark in a filled rounded-square; turn it off
   *   for a plain currentColor mark (large display / on-dark).
   * - `text={false}` renders the mark alone.
   * - `size` is a preset or a raw pixel height for the mark.
   */
  let {
    text = true,
    badge = true,
    size = "md",
    tone = "gradient",
    href,
    viewTransitionName,
    class: className = "",
    svgProps = {},
  }: {
    text?: boolean;
    badge?: boolean;
    size?: LogoSize | number;
    /** Glyph fill. `gradient` (brand) by default; use `mono` / `white` / `dark`
     *  on coloured surfaces where the gradient would clash. */
    tone?: LogoTone;
    href?: string;
    /** Opt-in `view-transition-name` so the logo can stay pinned across pages. */
    viewTransitionName?: string;
    class?: string;
    /** Escape hatch: `{ color }` forces an arbitrary glyph fill (overrides tone). */
    svgProps?: Record<string, string>;
  } = $props();

  const px = $derived(typeof size === "number" ? size : MARK_PX[size]);
  // Presets carry their own wordmark size; a raw px size lets the wordmark
  // inherit whatever text size the caller passes via `class`.
  const textCls = $derived(typeof size === "number" ? "" : TEXT_CLS[size]);

  // Resolve the glyph fill: explicit `svgProps.color` wins, else the tone.
  const fill = $derived(
    svgProps.color ??
      (tone === "mono"
        ? "currentColor"
        : tone === "white"
          ? "#ffffff"
          : tone === "dark"
            ? "#0a0a0c"
            : "url(#glyphGradient)"),
  );
</script>

{#snippet glyph(s: number, fill: string)}
  <svg
    width={s}
    height={s * 1.154}
    viewBox="0 0 312 360"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M149.534 0.990088C154.541 -0.930821 163.703 0.029633 170.521 3.12443C173.824 4.61847 183.625 10.3812 192.361 15.8238C218.888 32.3649 228.796 38.4478 245.415 48.2658C254.258 53.3882 263.313 58.9375 265.657 60.5383C268.001 62.139 274.18 65.6607 279.294 68.542C288.988 73.7712 303.264 83.9093 307.419 88.3914C311.574 92.8736 312.213 99.49 311.467 128.304C311.148 142.924 310.615 156.05 310.295 157.331C309.763 160.319 307.526 160.426 303.69 157.758C299.535 154.876 290.8 149.54 262.994 132.572C249.464 124.355 231.353 113.15 222.723 107.601C214.094 102.158 201.097 94.1542 193.639 89.8855C186.288 85.6168 177.126 79.9608 173.185 77.2929C161.253 69.0756 155.287 69.3958 141.011 79.3205C126.021 89.7894 102.648 105.007 98.3968 107.216L98.2051 107.312L77.1004 121.1C76.7915 121.303 76.5465 121.463 76.376 121.57C75.5876 122.221 72.3809 123.843 69.8454 125.636C61.7487 131.398 61.6422 132.145 61.6422 184.437V229.045L64.6252 232.033C66.2232 233.633 72.2957 238.116 78.1551 241.957C83.908 245.799 90.0871 250.175 91.6851 251.669C93.3897 253.163 101.699 258.605 110.222 263.728C118.745 268.957 126.948 274.186 128.546 275.573C130.144 276.854 135.791 280.802 141.011 284.217C149.853 289.98 151.025 290.514 156.459 290.407C164.449 290.407 168.177 288.379 202.695 265.115C209.513 260.526 215.053 256.471 215.053 256.044C215.053 254.87 173.504 219.547 152.73 203.006C149.747 200.765 144.42 196.176 140.798 192.974C134.406 187.425 134.086 186.891 134.086 182.409C134.086 178.461 134.619 177.18 137.602 174.299C139.519 172.485 146.444 165.868 152.943 159.572C159.442 153.275 165.94 147.833 167.538 147.406C172.439 146.232 177.02 147.619 185.543 153.062C190.124 155.837 195.664 159.358 198.007 160.852C200.351 162.346 207.915 166.829 214.733 170.884C221.658 174.939 231.885 181.235 237.425 184.864C247.333 191.373 259.904 199.164 280.039 211.436C307.739 228.191 308.271 228.618 310.082 232.353C311.787 235.768 312 240.357 312 281.123C312 320.608 311.787 326.264 310.295 327.758C309.443 328.718 308.058 329.466 307.312 329.466C306.673 329.466 300.92 325.304 294.528 320.074C288.243 314.952 282.277 310.256 281.318 309.723C280.466 309.083 278.228 307.375 276.524 305.774C274.819 304.174 271.09 301.292 268.214 299.478L262.994 296.17L259.031 299.329C258.637 299.649 258.349 299.862 258.264 299.926C257.529 300.396 256.239 301.25 253.022 303.608C252.319 304.003 247.695 306.809 243.285 309.509C238.597 312.177 228.689 318.367 221.125 323.276C213.668 328.185 202.908 335.015 197.262 338.536C191.615 342.058 183.199 347.714 178.405 351.129C164.768 360.947 156.352 362.334 144.207 356.678C141.331 355.291 132.169 349.848 123.965 344.513C115.762 339.283 104.043 331.92 97.8642 328.292C91.6851 324.663 82.0969 318.687 76.5571 315.059C66.9689 308.869 47.5795 296.49 36.0737 289.447C33.1973 287.632 27.5509 284.324 23.6091 282.083C10.2922 274.399 7.52227 271.945 3.79353 264.475L0.384406 257.431L0.0648001 182.943C-0.14827 131.719 0.171335 107.067 0.917082 104.186C2.40858 98.9564 8.37455 92.2333 16.0451 87.431C22.8633 83.0556 34.6888 75.3719 69.6323 52.6412C84.3342 43.0367 101.593 31.9381 107.985 27.9895C114.484 23.9343 120.876 19.7723 122.367 18.7051C123.859 17.5312 127.481 15.0768 130.357 13.0491C133.34 11.1282 138.134 7.81999 141.011 5.79236C143.994 3.76473 147.829 1.63039 149.534 0.990088Z"
      {fill}
    />
    <defs>
      <linearGradient
        id="glyphGradient"
        x1="1.75258e-05"
        y1="26.0545"
        x2="312.185"
        y2="333.758"
        gradientUnits="userSpaceOnUse"
      >
        <stop stop-color="#1F9CF0" />
        <stop offset="0.5" stop-color="#007ACC" />
        <stop offset="1" stop-color="#1177BB" />
      </linearGradient>
    </defs>
  </svg>
{/snippet}

<svelte:element
  this={href ? "a" : "span"}
  {href}
  class={cn("inline-flex shrink-0 items-center gap-2", className)}
  style:view-transition-name={viewTransitionName}
  aria-label="GlyphTeX"
>
  {#if badge}
    <span
      class="bg-primary text-primary-foreground grid shrink-0 place-items-center rounded-[28%]"
      style:width={`${px}px`}
      style:height={`${px}px`}
    >
      {@render glyph(px * 0.6, fill)}
    </span>
  {:else}
    <span
      class="text-foreground grid shrink-0 place-items-center"
      style:width={`${px}px`}
      style:height={`${px}px`}
    >
      {@render glyph(px, fill)}
    </span>
  {/if}

  {#if text}
    <span
      class={cn(
        "font-display font-semibold leading-none tracking-tight",
        textCls,
      )}>GlyphTeX</span
    >
  {/if}
</svelte:element>
