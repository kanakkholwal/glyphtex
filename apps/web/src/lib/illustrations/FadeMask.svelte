<script lang="ts">
	// Fades the lower part of a scene into the canvas. `id` must be unique per scene.
	let { id }: { id: string } = $props();
</script>

<defs>
	<linearGradient id="{id}-g" x1="0" y1="0" x2="0" y2="1">
		<stop offset="0.55" stop-color="white" />
		<stop offset="1" stop-color="black" />
	</linearGradient>
	<mask id={id} maskContentUnits="objectBoundingBox">
		<rect width="1" height="1" fill="url(#{id}-g)" />
	</mask>
</defs>
