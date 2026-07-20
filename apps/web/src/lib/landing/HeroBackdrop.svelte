<script lang="ts">
	// The editorial backdrop pattern: full-bleed photo behind a hero, faded at
	// top and bottom so the photo reads edge-to-edge while the page chrome
	// (header / footer) stays on clean ground. Used by both the hero and the
	// footer; the tone prop covers the three opacities they need:
	//
	//   - default (hero):   opacity-60 dark:opacity-40. Clear photo, room for content.
	//   - strong (footer):  opacity-90 dark:opacity-60. Full bleed, photo-first.
	//   - subtle (mid):     opacity-50 dark:opacity-30. Atmospheric, not the focus.

	type Props = {
		src: string;
		tone?: 'default' | 'strong' | 'subtle';
		class?: string;
	};

	let { src, tone = 'default', class: className = '' }: Props = $props();

	const toneClass = {
		default: 'opacity-60 dark:opacity-40',
		strong: 'opacity-90 dark:opacity-60',
		subtle: 'opacity-50 dark:opacity-30'
	} as const;
</script>

<div aria-hidden="true" class="pointer-events-none absolute inset-0 {className}">
	<div
		class="absolute inset-0 bg-cover bg-center {toneClass[tone]}"
		style="background-image: url('{src}');"
	></div>

	<!--
	  Soft bottom-up wash. The photo carries the top of the card with no
	  overlay at all; the wash ramps in only toward the lower third where
	  the headline + body sit, so dark text reads against the bright photo.
	  Top stays fully transparent, bottom ramps to ~70% canvas so the
	  body + CTAs land on a quieter reading surface.
	-->
	<div
		class="absolute inset-0"
		style="background: linear-gradient(to bottom,
	      transparent 0%,
	      transparent 28%,
	      color-mix(in oklab, var(--canvas) 28%, transparent) 62%,
	      color-mix(in oklab, var(--canvas) 70%, transparent) 100%);"
	></div>
</div>
