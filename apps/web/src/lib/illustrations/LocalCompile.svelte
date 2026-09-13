<script lang="ts" module>
	import { createScene } from "./iso";

	const s = createScene();
	const f = (n: number) => n.toFixed(1);

	const desk = s.box(-30, -30, -14, 480, 400, 14);

	const laptopBase = s.box(30, 176, 0, 190, 130, 10);
	const laptopScreen = s.box(30, 168, 10, 190, 8, 140);
	const screenFace = s.leftFace(30, 176, 10);
	// Source lines in screen space (v runs up): [indent, width]; the accent row is \section.
	const code: [number, number][] = [
		[0, 96],
		[0, 70],
		[14, 120],
		[14, 88],
		[14, 132],
		[0, 54]
	];

	const engine = s.box(270, 30, 0, 110, 110, 100);
	const engineRight = s.rightFace(380, 30, 0);
	const engineLeft = s.leftFace(270, 140, 0);

	const pageBack = s.box(350, 250, 34, 80, 100, 3);
	const page = s.box(340, 240, 46, 80, 100, 3);
	const texSheet = s.box(70, 10, 206, 64, 80, 3);

	const tethers = [
		s.tether([102, 50, 209], [325, 85, 100], 40),
		s.tether([325, 140, 60], [380, 290, 49], 20)
	];

	const commits = [
		[40, 340],
		[110, 340],
		[180, 340]
	];
	const branch = s.groundPath([110, 340, 150, 310, 250, 310]);
	const trunk = s.groundPath([40, 340, 180, 340]);
	const [headX, headY] = s.project([250, 310, 0]);

	const [cloudX, cloudY] = s.project([0, 170, 250]);
	s.project([-40, 170, 290]);
	const viewBox = s.viewBox();
</script>

<script lang="ts">
	import FadeMask from "./FadeMask.svelte";
	import "./iso.css";
	import Solid from "./Solid.svelte";

	let { class: className = "" }: { class?: string } = $props();
</script>

<svg
	{viewBox}
	class="iso block h-auto w-full {className}"
	role="img"
	aria-label="An isometric desk: LaTeX source on a laptop flows into a compile engine on the same desk and comes out as PDF pages, with Git commits beside it. A cloud above is crossed out."
>
	<FadeMask id="local-compile-fade" />

	<g mask="url(#local-compile-fade)">
		<Solid b={desk} />
		<path class="line" d={trunk} />
		<path class="line" d={branch} />
		{#each commits as [x, y] (x)}
			{@const [cx, cy] = s.project([x, y, 0])}
			<ellipse class="decal-fill cloud" cx={f(cx)} cy={f(cy)} rx="9" ry="5.2" />
		{/each}
		<ellipse class="accent-fill notify" cx={f(headX)} cy={f(headY)} rx="9" ry="5.2" />

		<Solid b={engine} accentTop>
			<g class="decal" transform={engineRight}>
				<circle cx="55" cy="54" r="24" />
				<circle cx="55" cy="54" r="9" />
				<path d="M55 22v8M55 78v8M23 54h8M79 54h8" />
			</g>
			<g class="decal" transform={engineLeft}>
				<path d="M20 20h70M20 32h70M20 44h70" />
			</g>
		</Solid>

		<Solid b={laptopBase} />
		<Solid b={laptopScreen}>
			<g class="decal screen" transform={screenFace}>
				<rect x="10" y="10" width="170" height="120" rx="6" />
				<path class="accent-line" d="M24 112h64" />
				{#each code as [indent, w], i (i)}
					<path d="M{24 + indent} {96 - i * 13}h{w}" />
				{/each}
				<path class="accent-line blink" d="M{24 + 54 + 6} 27v-8" />
			</g>
		</Solid>
	</g>

	{#each tethers as d (d)}
		<path class="dash flow" {d} />
	{/each}

	<g class="float">
		<Solid b={texSheet}>
			<g class="decal" transform={s.plane(209)}>
				<path d="M80 22h30M80 32h44M86 42h36M86 52h40M80 62h24" />
				<path class="accent-line" d="M80 74h16" />
			</g>
		</Solid>
	</g>

	<g class="float float-2">
		<Solid b={pageBack} />
		<Solid b={page}>
			<g class="decal" transform={s.plane(49)}>
				<path class="accent-line" d="M352 256h34" />
				<path d="M352 270h56M352 280h50M352 290h56" />
				<rect x="352" y="300" width="56" height="26" rx="2" />
			</g>
		</Solid>
	</g>

	<g class="float float-3" transform="translate({f(cloudX)} {f(cloudY)})">
		<path
			class="cloud"
			d="M-30 12a13 13 0 0 1 3-25 17 17 0 0 1 32-6 13 13 0 0 1 22 13 11 11 0 0 1-3 18z"
		/>
		<path class="line" d="M-34 -26L32 26" />
	</g>
</svg>
